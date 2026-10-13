import json
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from jobs import JobManager, BusyError, ConflictError, TERMINAL
import runner


class LifecycleTests(unittest.TestCase):
    def manager(self, executor, **kwargs):
        return JobManager(executor, audit=lambda event: None, **kwargs)

    def wait(self, manager, job_id):
        for _ in range(200):
            record = manager.get(job_id)
            if record['state'] in TERMINAL:
                return record
            time.sleep(.005)
        self.fail('Job did not finish')

    def test_cancel_capacity_idempotency_and_late_success(self):
        gate = threading.Event()
        calls = []
        def execute(*args, **kwargs):
            calls.append(args)
            gate.wait(1)
            return {'state': 'succeeded', 'passed': True, 'output': 'done', 'cleanup': 'confirmed'}
        manager = self.manager(execute, max_active=1)
        mission = runner.MISSIONS['M07']
        job = manager.submit(mission, 'secret learner code', 'a' * 32)
        try:
            self.assertEqual(manager.submit(mission, 'secret learner code', job['id'])['id'], job['id'])
            with self.assertRaises(ConflictError):
                manager.submit(mission, 'different', job['id'])
            with self.assertRaises(BusyError):
                manager.submit(mission, 'second')
            self.assertEqual(manager.cancel(job['id'])['state'], 'cancelling')
            manager.cancel(job['id'])
        finally:
            gate.set()
        result = self.wait(manager, job['id'])
        self.assertEqual(result['state'], 'cancelled')
        self.assertFalse(result['passed'])
        self.assertEqual(len(calls), 1)
        self.assertEqual([e['event'] for e in result['events']].count('cancel_requested'), 1)
        self.assertNotIn('secret learner code', json.dumps(result))
        self.assertEqual(manager.cancel(job['id']), result)

    def test_expiry_and_record_capacity(self):
        manager = self.manager(lambda *a, **k: {'state': 'failed', 'passed': False, 'output': 'check failed', 'cleanup': 'confirmed'}, max_records=1)
        job = manager.submit(runner.MISSIONS['M07'], 'first')
        self.wait(manager, job['id'])
        with self.assertRaises(BusyError):
            manager.submit(runner.MISSIONS['M07'], 'second')
        manager.jobs[job['id']]['finished'] -= 901
        with self.assertRaises(KeyError):
            manager.get(job['id'])
        self.wait(manager, manager.submit(runner.MISSIONS['M07'], 'second')['id'])

    def test_failure_and_later_cleanup_confirmation(self):
        def broken(*a, **k):
            raise OSError('private daemon details')
        manager = self.manager(broken)
        job = manager.submit(runner.MISSIONS['M07'], 'code')
        record = self.wait(manager, job['id'])
        self.assertEqual(record['state'], 'error')
        self.assertNotIn('private', record['output'])
        self.assertEqual(record['cleanup'], 'pending')
        manager.cleaned(job['id'])
        self.assertEqual(manager.get(job['id'])['cleanup'], 'confirmed')

    def test_image_identity_and_no_pull_or_host_mounts(self):
        image = {'Id': 'sha256:' + 'b' * 64, 'RepoDigests': ['python@sha256:' + 'c' * 64]}
        with patch.object(runner.subprocess, 'run', return_value=SimpleNamespace(stdout=json.dumps(image))):
            identity = runner.image_identity('python:example')
        self.assertEqual(identity['id'], image['Id'])
        args = runner.docker_args('forge-' + 'a' * 32, identity['id'], 123)
        self.assertIn(image['Id'], args)
        self.assertIn('--pull=never', args)
        self.assertIn('platform-forge.expires=123', args)
        self.assertNotIn('-v', args)

    def test_expired_cleanup_respects_namespace_name_and_deadline(self):
        def inspect(name, owner, expires):
            return SimpleNamespace(stdout=json.dumps([{'Name': name, 'Config': {'Labels': {
                'platform-forge.managed': 'v1', 'platform-forge.owner': owner, 'platform-forge.expires': str(expires)}}}]))
        outcomes = [SimpleNamespace(stdout='a'*12 + '\n' + 'b'*12 + '\n' + 'c'*12 + '\n' + 'd'*12),
            inspect('/forge-' + 'a'*32, runner.RUNNER_ID, 99),
            inspect('/forge-' + 'b'*32, 'other-owner', 99),
            inspect('/valuable-service', runner.RUNNER_ID, 99),
            inspect('/forge-' + 'd'*32, runner.RUNNER_ID, 101)]
        with patch.object(runner.subprocess, 'run', side_effect=outcomes), patch.object(runner, 'remove_container', return_value=True) as remove:
            self.assertEqual(runner.reap_expired(now=100), ['a'*32])
            remove.assert_called_once_with('a'*12)

    def test_cancel_before_execution_never_starts_a_container(self):
        cancel = threading.Event(); cancel.set()
        with patch.object(runner.subprocess, 'Popen') as start, patch.object(runner, 'remove_container', return_value=True):
            result = runner.execute('M07', 'secret', cancel=cancel)
        start.assert_not_called()
        self.assertEqual(result['state'], 'cancelled')
        self.assertEqual(result['cleanup'], 'confirmed')
