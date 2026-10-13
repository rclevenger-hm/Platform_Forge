"""Exercise accounts against the running Docker app and its persistent volume."""
import http.cookiejar
import json
import subprocess
import time
import urllib.request
import uuid

base = 'http://127.0.0.1:8080/api/'
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
csrf = ''
def request(path, body=None):
    headers = {'Content-Type': 'application/json', 'X-Forge-Client': '1', 'X-CSRF-Token': csrf}
    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
    with client.open(req, timeout=8) as result:
        return json.loads(result.read())
username = 'ci_' + uuid.uuid4().hex[:16]
password = uuid.uuid4().hex + '-passphrase'
auth = request('auth/register', {'username': username, 'password': password})
csrf = auth['csrf']
progress = {'version': 4, 'attempts': [], 'notes': {'M01': 'Persistent Docker account evidence'}}
assert request('account/progress', {'revision': 0, 'progress': progress})['revision'] == 1
subprocess.run(['docker', 'compose', 'restart', 'api'], check=True, timeout=30)
for _ in range(30):
    try:
        request('health')
        break
    except Exception:
        time.sleep(1)
else:
    raise AssertionError('API did not restart')
assert request('account/progress')['progress'] == progress
request('auth/logout', {})
auth = request('auth/login', {'username': username, 'password': password}); csrf = auth['csrf']
assert request('account/progress')['revision'] == 1
print('Docker registration, progress persistence through restart, logout and login passed.')
