"""Opt-in Docker Python and Bash runner. Run only on a dedicated lab Docker daemon."""
import hmac
import json
import os
import selectors
import subprocess
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MISSIONS = {m['id']: m for m in json.loads((Path(__file__).resolve().parent.parent / 'src/data/missions.json').read_text())}
IMAGE = os.environ.get('LAB_IMAGE', 'python:3.13-alpine')
BASH_IMAGE = os.environ.get('BASH_LAB_IMAGE', 'platform-forge-bash:0.2')
TOKEN = os.environ.get('RUNNER_TOKEN', '')
SLOTS = threading.BoundedSemaphore(2)


def docker_args(name, image=None):
    return ['docker', 'run', '--rm', '--name', name, '--label', 'platform-forge.lab=true',
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


def execute(mission_id, code):
    mission = MISSIONS.get(mission_id)
    if not mission or not (mission['kind'] == 'python' or mission.get('runtime') == 'bash') or not isinstance(code, str) or len(code) > 24000:
        raise ValueError('Invalid executable mission or code length.')
    name = 'forge-' + uuid.uuid4().hex
    # Authored checks, not a high-stakes judge: the learner can inspect or subvert these checks.
    is_bash = mission.get('runtime') == 'bash'
    program = bash_program(code, mission['cases']) if is_bash else code + '\n\n' + mission['tests'] + '\nprint("All practice checks passed.")\n'
    process = None
    output = bytearray()
    failure = ''
    try:
        process = subprocess.Popen(docker_args(name, BASH_IMAGE if is_bash else IMAGE), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        # Feed input on a separate thread so a stalled Docker daemon cannot block the deadline.
        def feed():
            try:
                process.stdin.write(program.encode())
                process.stdin.close()
            except (BrokenPipeError, OSError):
                pass
        writer = threading.Thread(target=feed, daemon=True)
        writer.start()
        deadline = time.monotonic() + 10
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            while True:
                if time.monotonic() > deadline:
                    failure = 'Execution exceeded 10 seconds.'
                    break
                ready = selector.select(.1)
                if ready:
                    chunk = os.read(process.stdout.fileno(), 4096)
                    if not chunk:
                        break
                    output.extend(chunk)
                    if len(output) > 16000:
                        failure = 'Output exceeded 16 KB.'
                        break
        if not failure:
            try:
                process.wait(timeout=max(.1, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                failure = 'Execution exceeded 10 seconds.'
        return {'passed': not failure and process.returncode == 0,
                'output': output[:16000].decode(errors='replace') + ('\n' + failure if failure else '')}
    finally:
        if process and process.poll() is None:
            process.kill()
            process.wait(timeout=2)
        try:
            subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=4)
        except (OSError, subprocess.TimeoutExpired):
            pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, body):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def auth(self):
        return bool(TOKEN) and hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN)

    def do_GET(self):
        if not self.auth():
            return self.reply(401, {'error': 'Unauthorized.'})
        if self.path != '/health':
            return self.reply(404, {'error': 'Not found.'})
        try:
            languages = available_languages()
            self.reply(200, {'ready': bool(languages), 'languages': languages})
        except Exception:
            self.reply(503, {'ready': False})

    def do_POST(self):
        if not self.auth():
            return self.reply(401, {'error': 'Unauthorized.'})
        if self.path != '/run':
            return self.reply(404, {'error': 'Not found.'})
        if not SLOTS.acquire(blocking=False):
            return self.reply(429, {'error': 'Runner busy.'})
        try:
            self.connection.settimeout(5)
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 40000:
                raise ValueError('Invalid body length.')
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError('Expected object.')
            self.reply(200, execute(body.get('missionId'), body.get('code')))
        except ValueError:
            self.reply(400, {'error': 'Invalid request.'})
        except Exception:
            self.reply(503, {'error': 'Lab unavailable.'})
        finally:
            SLOTS.release()


if __name__ == '__main__':
    if not TOKEN:
        raise SystemExit('Set RUNNER_TOKEN before enabling Docker execution.')
    ThreadingHTTPServer(('0.0.0.0', 8788), Handler).serve_forever()
