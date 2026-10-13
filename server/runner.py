"""Opt-in Docker Python and Bash runner. Run only on a dedicated lab Docker daemon."""
import hmac
import json
import os
import re
import selectors
import subprocess
import threading
import time
import uuid
from jobs import JobManager, BusyError, ConflictError, TERMINAL
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MISSIONS = {m['id']: m for m in json.loads((Path(__file__).resolve().parent.parent / 'src/data/missions.json').read_text())}
IMAGE = os.environ.get('LAB_IMAGE', 'python:3.13-alpine')
BASH_IMAGE = os.environ.get('BASH_LAB_IMAGE', 'platform-forge-bash:0.2')
TOKEN = os.environ.get('RUNNER_TOKEN', '')
RUNNER_ID = os.environ.get('LAB_RUNNER_ID', 'local')
if not re.fullmatch(r'[a-zA-Z0-9_-]{1,40}', RUNNER_ID):
    raise ValueError('LAB_RUNNER_ID must contain 1–40 letters, digits, underscores or dashes.')
JOB_ID = re.compile(r'[a-f0-9]{32}')


def docker_args(name, image=None, expires=None):
    return ['docker', 'run', '--rm', '--name', name, '--label', 'platform-forge.lab=true',
            '--label', 'platform-forge.managed=v1', '--label', 'platform-forge.owner=' + RUNNER_ID,
            '--label', 'platform-forge.expires=' + str(expires or int(time.time()) + 30),
            '--pull=never', '--network=none', '--read-only', '--cap-drop=ALL',
            '--security-opt=no-new-privileges', '--user=65534:65534', '--memory=128m',
            '--memory-swap=128m', '--cpus=0.5', '--pids-limit=32',
            '--tmpfs=/tmp:rw,noexec,nosuid,size=16m', '-i', image or IMAGE, 'python', '-I', '-B', '-u', '-']


def bash_program(code, cases):
    # Only repository-authored cases reach this function; uploaded previews never run.
    # Learner source is a string literal, never interpolated into Python syntax.
    payload = json.dumps({'code': code, 'cases': cases})
    return "import json, os, subprocess, tempfile\ndata = json.loads(" + repr(payload) + ")\n" + r"""
for case in data['cases']:
    with tempfile.TemporaryDirectory(dir='/tmp') as directory:
        script = os.path.join(directory, 'solution.sh')
        with open(script, 'w') as handle:
            handle.write(data['code'])
        # A real file makes unquoted wildcard expansion observable in the lab.
        with open(os.path.join(directory, 'sentinel.txt'), 'w') as handle:
            handle.write('fixture')
        with tempfile.TemporaryFile() as output:
            child = subprocess.run(['bash', '--noprofile', '--norc', script, *case['args']],
                input=case['stdin'].encode(), stdout=output, stderr=subprocess.STDOUT,
                cwd=directory, env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': directory, 'LANG': 'C.UTF-8'}, timeout=2)
            output.seek(0)
            actual = output.read(16001)
        assert len(actual) <= 16000, case['label'] + ': output exceeded 16 KB'
        assert child.returncode == case['exit'], case['label'] + ': unexpected exit status ' + str(child.returncode)
        assert actual.decode(errors='replace') == case['stdout'], case['label'] + ': output did not match argument boundaries or expected text'
        print('PASS: ' + case['label'])
print('All practice checks passed.')
"""


def available_languages():
    languages = []
    for language, image in [('python', IMAGE), ('bash', BASH_IMAGE)]:
        try:
            result = subprocess.run(['docker', 'image', 'inspect', image], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)
            if result.returncode == 0:
                languages.append(language)
        except (OSError, subprocess.TimeoutExpired):
            pass
    return languages


def executable(mission_id, code):
    mission = MISSIONS.get(mission_id) if isinstance(mission_id, str) else None
    if not mission or not (mission['kind'] == 'python' or mission.get('runtime') == 'bash') or not isinstance(code, str) or len(code) > 24000:
        raise ValueError('Invalid executable mission or code length.')
    return mission


def image_identity(reference):
    result = subprocess.run(['docker', 'image', 'inspect', '--format', '{{json .}}', reference],
                            capture_output=True, text=True, timeout=3, check=True)
    info = json.loads(result.stdout)
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', info.get('Id', '')):
        raise ValueError('Unable to resolve immutable image ID.')
    return {'reference': reference, 'id': info['Id'], 'digests': info.get('RepoDigests') or []}


def remove_container(name):
    try:
        result = subprocess.run(['docker', 'rm', '-f', name], capture_output=True, text=True, timeout=3)
        return result.returncode == 0 or 'No such container' in result.stderr
    except (OSError, subprocess.TimeoutExpired):
        return False


def reap_expired(now=None):
    """Only expired v1 containers in this configured runner namespace are eligible."""
    now = time.time() if now is None else now
    removed = []
    try:
        listing = subprocess.run(['docker', 'ps', '-aq', '--filter', 'label=platform-forge.managed=v1',
            '--filter', 'label=platform-forge.owner=' + RUNNER_ID], capture_output=True, text=True, timeout=3, check=True)
        for container in listing.stdout.split()[:100]:
            if not re.fullmatch(r'[a-f0-9]{12,64}', container):
                continue
            try:
                raw = subprocess.run(['docker', 'inspect', container], capture_output=True, text=True, timeout=3, check=True)
                info = json.loads(raw.stdout)[0]
                labels = info.get('Config', {}).get('Labels', {}) or {}
                name = info.get('Name', '').lstrip('/')
                if (labels.get('platform-forge.managed') != 'v1' or labels.get('platform-forge.owner') != RUNNER_ID
                        or not re.fullmatch(r'forge-[a-f0-9]{32}', name)):
                    continue
                expires = int(labels.get('platform-forge.expires', '0'))
                if 0 < expires <= now and remove_container(container):
                    removed.append(name.removeprefix('forge-'))
            except (OSError, ValueError, KeyError, IndexError, subprocess.SubprocessError):
                continue
    except (OSError, subprocess.SubprocessError):
        pass
    return removed


def execute(mission_id, code, job_id=None, cancel=None):
    mission = executable(mission_id, code)
    job_id = job_id or uuid.uuid4().hex
    if not JOB_ID.fullmatch(job_id):
        raise ValueError('Invalid run ID.')
    cancel = cancel or threading.Event()
    name = 'forge-' + job_id
    is_bash = mission.get('runtime') == 'bash'
    program = bash_program(code, mission['cases']) if is_bash else code + '\n\n' + mission['tests'] + '\nprint("All practice checks passed.")\n'
    process = None
    output = bytearray()
    result = {'state': 'error', 'passed': False, 'output': '', 'image': None, 'cleanup': 'pending'}
    failure = ''
    try:
        if cancel.is_set():
            result['state'] = 'cancelled'
        else:
            result['image'] = image_identity(BASH_IMAGE if is_bash else IMAGE)
            # Pin to the inspected content ID so retagging cannot change this run's image.
            if cancel.is_set():
                result['state'] = 'cancelled'
            else:
                process = subprocess.Popen(docker_args(name, result['image']['id']), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                def feed():
                    try:
                        process.stdin.write(program.encode())
                        process.stdin.close()
                    except (BrokenPipeError, OSError):
                        pass
                threading.Thread(target=feed, daemon=True).start()
                deadline = time.monotonic() + 10
                with selectors.DefaultSelector() as selector:
                    selector.register(process.stdout, selectors.EVENT_READ)
                    while True:
                        if cancel.is_set():
                            result['state'], failure = 'cancelled', 'Run cancelled.'
                            break
                        if time.monotonic() >= deadline:
                            result['state'], failure = 'timed_out', 'Execution exceeded 10 seconds.'
                            break
                        if selector.select(.1):
                            chunk = os.read(process.stdout.fileno(), 4096)
                            if not chunk:
                                break
                            output.extend(chunk)
                            if len(output) > 16000:
                                result['state'], failure = 'output_limit', 'Output exceeded 16 KB.'
                                break
                if not failure:
                    try:
                        process.wait(timeout=max(.1, deadline - time.monotonic()))
                        result['state'] = 'succeeded' if process.returncode == 0 else 'failed'
                    except subprocess.TimeoutExpired:
                        result['state'], failure = 'timed_out', 'Execution exceeded 10 seconds.'
                result['passed'] = result['state'] == 'succeeded'
    except (OSError, ValueError, subprocess.SubprocessError):
        failure = 'Lab unavailable. Check the Docker daemon and configured image.'
    finally:
        if process and process.poll() is None:
            process.kill()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                pass
        # Container removal, not killing the Docker CLI, ends learner execution.
        result['cleanup'] = 'confirmed' if remove_container(name) else 'pending'
        if process and process.stdout:
            process.stdout.close()
    result['output'] = output[:16000].decode(errors='replace') + ('\n' + failure if failure else '')
    if cancel.is_set():
        result.update(state='cancelled', passed=False)
    return result


JOBS = JobManager(execute)


def maintenance():
    while True:
        for job_id in reap_expired():
            JOBS.cleaned(job_id)
            print(json.dumps({'event': 'expired_container_removed', 'jobId': job_id}), flush=True)
        for job_id in JOBS.pending_cleanup():
            if remove_container('forge-' + job_id):
                JOBS.cleaned(job_id)
        JOBS.sweep()
        time.sleep(5)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, body):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def auth(self):
        return bool(TOKEN) and hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN)

    def do_GET(self):
        if not self.auth():
            return self.reply(401, {'error': 'Unauthorized.'})
        if self.path == '/health':
            languages = available_languages()
            return self.reply(200, {'ready': bool(languages), 'languages': languages, 'jobProtocol': 1,
                'maxRunSeconds': 10, 'recordTtlSeconds': 900})
        match = re.fullmatch(r'/jobs/([a-f0-9]{32})', self.path)
        if match:
            try:
                return self.reply(200, JOBS.get(match[1]))
            except KeyError:
                return self.reply(404, {'error': 'Run not found or expired.'})
        self.reply(404, {'error': 'Not found.'})

    def do_POST(self):
        if not self.auth():
            return self.reply(401, {'error': 'Unauthorized.'})
        match = re.fullmatch(r'/jobs/([a-f0-9]{32})/cancel', self.path)
        if self.path not in ('/run', '/jobs') and not match:
            return self.reply(404, {'error': 'Not found.'})
        try:
            self.connection.settimeout(5)
            length = int(self.headers.get('Content-Length', '0'))
            if self.headers.get_content_type() != 'application/json' or not 0 < length <= 40000:
                raise ValueError('Invalid body.')
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError('Expected object.')
            if match:
                return self.reply(200, JOBS.cancel(match[1]))
            mission = executable(body.get('missionId'), body.get('code'))
            job_id = body.get('jobId')
            if job_id is not None and (not isinstance(job_id, str) or not JOB_ID.fullmatch(job_id)):
                raise ValueError('Invalid run ID.')
            record = JOBS.submit(mission, body['code'], job_id)
            if self.path == '/jobs':
                return self.reply(202, record)
            # Backward-compatible clients share exactly the same admission/cleanup path.
            while record['state'] not in TERMINAL:
                time.sleep(.1)
                record = JOBS.get(record['id'])
            self.reply(200, {'passed': record['passed'], 'output': record['output']})
        except KeyError:
            self.reply(404, {'error': 'Run not found or expired.'})
        except BusyError as error:
            self.reply(429, {'error': str(error)})
        except ConflictError as error:
            self.reply(409, {'error': str(error)})
        except (ValueError, TypeError):
            self.reply(400, {'error': 'Invalid request.'})
        except Exception:
            self.reply(503, {'error': 'Lab unavailable.'})


if __name__ == '__main__':
    if not TOKEN:
        raise SystemExit('Set RUNNER_TOKEN before enabling Docker execution.')
    threading.Thread(target=maintenance, daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', 8788), Handler).serve_forever()
