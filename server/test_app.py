import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from unittest.mock import patch
import app
import runner


class GatewayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        cls.url = 'http://127.0.0.1:' + str(cls.server.server_port)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, path, body=None, headers=None):
        req = urllib.request.Request(self.url + path, data=json.dumps(body).encode() if body is not None else None, headers=headers or {})
        try:
            response = urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.loads(response.read())

    def test_token_and_origin_are_enforced(self):
        with patch.dict(os.environ, {'API_TOKEN': 'test-secret', 'ALLOWED_ORIGINS': 'https://allowed.example'}):
            self.assertEqual(self.request('/api/capabilities')[0], 401)
            self.assertEqual(self.request('/api/capabilities', headers={'Authorization': 'Bearer test-secret', 'Origin': 'https://evil.example'})[0], 403)
            with patch.object(app, 'capabilities', return_value={'tutor': False, 'runner': False}):
                self.assertEqual(self.request('/api/capabilities', headers={'Authorization': 'Bearer test-secret', 'Origin': 'https://allowed.example'})[0], 200)

    def test_health_does_not_require_token(self):
        with patch.dict(os.environ, {'API_TOKEN': 'secret'}):
            self.assertEqual(self.request('/api/health'), (200, {'ok': True}))

    def test_optional_outage_has_no_tutor_capability(self):
        with patch.dict(os.environ, {'LLM_BASE_URL': 'http://localhost:1/v1', 'LLM_MODEL': 'test', 'RUNNER_URL': ''}), patch.object(app, 'upstream', side_effect=OSError()):
            self.assertEqual(app.capabilities(), {'connected': True, 'tutor': False, 'runner': False})

    def test_model_must_be_available(self):
        with patch.dict(os.environ, {'LLM_BASE_URL': 'http://localhost/v1', 'LLM_MODEL': 'wanted', 'RUNNER_URL': ''}), patch.object(app, 'upstream', return_value={'data': [{'id': 'other'}]}):
            self.assertFalse(app.capabilities()['tutor'])

    def test_tutor_grounds_lesson_and_keeps_key_out_of_body(self):
        with patch.dict(os.environ, {'LLM_BASE_URL': 'https://example.test/v1', 'LLM_MODEL': 'test', 'LLM_API_KEY': 'test-provider-key-abc123'}), patch.object(app, 'upstream', return_value={'choices': [{'message': {'content': 'Try checking the path.'}}]}) as mock:
            self.assertEqual(app.tutor({'missionId': 'M01', 'question': 'Help'})['answer'], 'Try checking the path.')
            payload = mock.call_args.args[1]
            self.assertIn('Find your way home', payload['messages'][0]['content'])
            self.assertNotIn('test-provider-key-abc123', json.dumps(payload))
            self.assertEqual(mock.call_args.kwargs['token'], 'test-provider-key-abc123')

    def test_public_cannot_supply_tests_or_provider_url(self):
        with self.assertRaises(ValueError):
            app.run({'missionId': 'M01', 'code': 'print(1)'})
        with self.assertRaises(ValueError):
            app.endpoint('http://user:pass@example.test', 'models')

    def test_runner_uses_resource_limits_and_no_host_mounts(self):
        args = runner.docker_args('forge-test')
        for required in ['--network=none', '--read-only', '--cap-drop=ALL', '--user=65534:65534', '--memory=128m', '--pids-limit=32', '--security-opt=no-new-privileges']:
            self.assertIn(required, args)
        self.assertNotIn('--privileged', args)
        self.assertNotIn('-v', args)

    def test_authored_python_solutions_pass_and_starters_fail(self):
        for mission in app.MISSIONS.values():
            if mission['kind'] != 'python':
                continue
            with self.subTest(mission=mission['id']):
                scope = {}
                exec(mission['solution'], scope)
                exec(mission['tests'], scope)
                scope = {}
                with self.assertRaises((AssertionError, TypeError, ValueError, NotImplementedError, RuntimeError)):
                    exec(mission['starter'], scope)
                    exec(mission['tests'], scope)


if __name__ == '__main__':
    unittest.main()
