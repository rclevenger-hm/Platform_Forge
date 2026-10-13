"""Meaningful Docker integration checks; run only on a disposable lab/CI daemon."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'server'))
from runner import execute, MISSIONS

mission = MISSIONS['M07']
good = execute('M07', mission['solution'])
assert good['passed'], good
bad = execute('M07', mission['starter'])
assert not bad['passed'], bad
loop = execute('M07', 'while True: pass')
assert not loop['passed'] and 'exceeded' in loop['output'], loop
filesystem = execute('M07', "open('/forbidden.txt', 'w').write('blocked')")
assert not filesystem['passed'] and ('Read-only' in filesystem['output'] or 'Permission' in filesystem['output']), filesystem
print('Docker execution, failed solution, deadline and filesystem isolation checks passed.')

for mission in MISSIONS.values():
    if mission.get('runtime') == 'bash':
        good = execute(mission['id'], mission['solution'])
        assert good['passed'], (mission['id'], good)
        bad = execute(mission['id'], mission['starter'])
        assert not bad['passed'], (mission['id'], bad)
print('All Bash solutions pass; broken argument and pipeline starters fail.')

import subprocess
import time
import uuid
from runner import docker_args, reap_expired, RUNNER_ID
from jobs import JobManager, BusyError, TERMINAL

manager = JobManager(execute)
job = manager.submit(MISSIONS['M07'], 'while True: pass')
for _ in range(50):
    live = subprocess.run(['docker', 'inspect', '--format', '{{.State.Running}}', 'forge-' + job['id']], capture_output=True, text=True, timeout=2)
    if live.returncode == 0 and live.stdout.strip() == 'true':
        break
    time.sleep(.1)
else:
    raise AssertionError('The cancellation test never reached an executing container')
manager.cancel(job['id'])
for _ in range(100):
    cancelled = manager.get(job['id'])
    if cancelled['state'] in TERMINAL:
        break
    time.sleep(.1)
assert cancelled['state'] == 'cancelled' and not cancelled['passed'], cancelled
assert cancelled['cleanup'] == 'confirmed', cancelled
left = subprocess.run(['docker', 'ps', '-aq', '--filter', 'name=forge-' + job['id']], capture_output=True, text=True, check=True)
assert not left.stdout.strip(), left.stdout
assert good['image']['id'].startswith('sha256:'), good
# A process lost during a runner crash leaves only labels for a new process to inspect.
orphan_id = uuid.uuid4().hex
args = docker_args('forge-' + orphan_id, expires=int(time.time()) - 1)
args.remove('-i'); args.insert(2, '-d')
args[-1:] = ['-c', 'import time; time.sleep(120)']
try:
    subprocess.run(args, capture_output=True, check=True, timeout=10)
    assert orphan_id in reap_expired(), 'Expired orphan was not removed'
finally:
    subprocess.run(['docker', 'rm', '-f', 'forge-' + orphan_id], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('Managed cancellation, immutable image identity and restart-style orphan cleanup passed.')
