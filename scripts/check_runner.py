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
