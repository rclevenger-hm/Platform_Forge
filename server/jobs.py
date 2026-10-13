"""Bounded, in-memory execution records; one trusted learner per runner."""
import copy
import hashlib
import json
import threading
import time
import uuid
from datetime import datetime, timezone

TERMINAL = frozenset(('succeeded', 'failed', 'cancelled', 'timed_out', 'output_limit', 'error'))


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


class BusyError(Exception):
    pass


class ConflictError(Exception):
    pass


class JobManager:
    def __init__(self, execute, max_active=2, retention=900, max_records=100, audit=None):
        self.execute = execute
        self.max_active, self.retention, self.max_records = max_active, retention, max_records
        self.jobs = {}
        self.lock = threading.RLock()
        self.audit = audit or (lambda event: print(json.dumps(event), flush=True))

    def event(self, job, kind):
        event = {'at': timestamp(), 'event': kind}
        job['record']['events'].append(event)
        job['record']['events'] = job['record']['events'][-20:]
        # Never write learner source, output, tokens, or upstream configuration.
        self.audit({'jobId': job['record']['id'], 'missionId': job['record']['missionId'], **event})

    def sweep(self):
        with self.lock:
            now = time.monotonic()
            for key, job in list(self.jobs.items()):
                if job['finished'] is not None and now - job['finished'] >= self.retention:
                    self.event(job, 'record_expired')
                    del self.jobs[key]

    def submit(self, mission, code, job_id=None):
        job_id = job_id or uuid.uuid4().hex
        fingerprint = hashlib.sha256((mission['id'] + '\0' + str(mission['version']) + '\0' + code).encode()).hexdigest()
        with self.lock:
            self.sweep()
            existing = self.jobs.get(job_id)
            if existing:
                if existing['fingerprint'] != fingerprint:
                    raise ConflictError('Run ID already belongs to a different submission.')
                return copy.deepcopy(existing['record'])
            if sum(j['record']['state'] not in TERMINAL for j in self.jobs.values()) >= self.max_active:
                raise BusyError('Runner busy. Two runs are already active.')
            # Bound memory without silently evicting unexpired records used by polling clients.
            if len(self.jobs) >= self.max_records:
                raise BusyError('Run record capacity reached. Retry after older records expire.')
            job = {'record': {'id': job_id, 'missionId': mission['id'], 'missionVersion': mission['version'],
                'state': 'starting', 'createdAt': timestamp(), 'startedAt': None, 'finishedAt': None,
                'recordExpiresAt': None, 'maxRunSeconds': 10, 'passed': False, 'output': '',
                'cleanup': 'pending', 'image': None, 'events': []},
                'cancel': threading.Event(), 'finished': None, 'fingerprint': fingerprint}
            self.jobs[job_id] = job
            self.event(job, 'accepted')
            threading.Thread(target=self.work, args=(job, mission['id'], code), daemon=True).start()
            return copy.deepcopy(job['record'])

    def work(self, job, mission_id, code):
        with self.lock:
            job['record']['startedAt'] = timestamp()
            if not job['cancel'].is_set():
                job['record']['state'] = 'running'
            self.event(job, 'running')
        try:
            result = self.execute(mission_id, code, job_id=job['record']['id'], cancel=job['cancel'])
        except Exception:
            result = {'state': 'error', 'passed': False, 'output': 'Lab execution unavailable.', 'cleanup': 'pending'}
        with self.lock:
            # A cancel accepted before completion wins the race with a late success.
            if job['cancel'].is_set():
                result.update(state='cancelled', passed=False)
            if result.get('state') not in TERMINAL:
                result.update(state='error', passed=False)
            job['record'].update({k: result[k] for k in ('state', 'passed', 'output', 'cleanup', 'image') if k in result})
            job['record']['finishedAt'] = timestamp()
            job['record']['recordExpiresAt'] = datetime.fromtimestamp(time.time() + self.retention, timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
            job['finished'] = time.monotonic()
            self.event(job, job['record']['state'])
            self.event(job, 'cleanup_' + job['record']['cleanup'])

    def get(self, job_id):
        with self.lock:
            self.sweep()
            if job_id not in self.jobs:
                raise KeyError(job_id)
            return copy.deepcopy(self.jobs[job_id]['record'])

    def cancel(self, job_id):
        with self.lock:
            self.sweep()
            if job_id not in self.jobs:
                raise KeyError(job_id)
            job = self.jobs[job_id]
            if job['record']['state'] not in TERMINAL and not job['cancel'].is_set():
                job['cancel'].set()
                job['record']['state'] = 'cancelling'
                self.event(job, 'cancel_requested')
            return copy.deepcopy(job['record'])

    def pending_cleanup(self):
        with self.lock:
            return [key for key, job in self.jobs.items() if job['finished'] is not None
                    and time.monotonic() - job['finished'] >= 5 and job['record']['cleanup'] == 'pending']

    def cleaned(self, job_id):
        with self.lock:
            job = self.jobs.get(job_id)
            if job and job['record']['state'] in TERMINAL and job['record']['cleanup'] != 'confirmed':
                job['record']['cleanup'] = 'confirmed'
                self.event(job, 'cleanup_confirmed')
