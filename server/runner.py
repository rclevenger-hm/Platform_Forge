"""Opt-in Docker Python runner. Run only on a dedicated lab Docker daemon."""
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
TOKEN = os.environ.get('RUNNER_TOKEN', '')
SLOTS = threading.BoundedSemaphore(2)


def docker_args(name):
    return ['docker', 'run', '--rm', '--name', name, '--label', 'platform-forge.lab=true',
            '--pull=never', '--network=none', '--read-only', '--cap-drop=ALL',
            '--security-opt=no-new-privileges', '--user=65534:65534', '--memory=128m',
            '--memory-swap=128m', '--cpus=0.5', '--pids-limit=32',
            '--tmpfs=/tmp:rw,noexec,nosuid,size=16m', '-i', IMAGE, 'python', '-I', '-B', '-u', '-']


def execute(mission_id, code):
    mission = MISSIONS.get(mission_id)
    if not mission or mission['kind'] != 'python' or not isinstance(code, str) or len(code) > 24000:
        raise ValueError('Invalid Python mission or code length.')
    name = 'forge-' + uuid.uuid4().hex
    # Authored checks, not a high-stakes judge: the learner can inspect or subvert these checks.
    program = code + '\n\n' + mission['tests'] + '\nprint("All practice checks passed.")\n'
    process = None
    output = bytearray()
    failure = ''
    try:
        process = subprocess.Popen(docker_args(name), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
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
            result = subprocess.run(['docker', 'image', 'inspect', IMAGE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            self.reply(200, {'ready': result.returncode == 0})
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
