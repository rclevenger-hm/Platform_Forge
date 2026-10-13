import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,validateProgress} from '../src/lib/progress.mjs';
import {mergeGuestProgress,accountKey} from '../src/lib/account.mjs';
import {cleanRun} from '../src/lib/jobs.mjs';

test('explicit guest import preserves account notes, deduplicates evidence and keeps identities separate',()=>{
  const account=fresh(), guest=fresh();
  account.notes={M01:'Account note'}; guest.notes={M01:'Guest note',M02:'New guest note'};
  guest.designs=[{at:'2026-10-13T00:00:00Z',name:'Experiment',rationale:'Evidence',config:{nodes:2}}];
  account.designs=[...guest.designs];
  const merged=mergeGuestProgress(account,guest);
  assert.equal(merged.notes.M01,'Account note'); assert.equal(merged.notes.M02,'New guest note');
  assert.equal(merged.designs.length,1); assert.equal(guest.notes.M01,'Guest note');
  assert.notEqual(accountKey('https://one.test','a'),accountKey('https://one.test','b'));
  assert.notEqual(accountKey('https://one.test','a'),accountKey('https://two.test','a'));
});
test('runtime records cannot turn cancellation into a learning pass and survive bounded migration',()=>{
  const run={id:'a'.repeat(32),missionId:'M07',missionVersion:1,state:'cancelled',passed:true,cleanup:'confirmed',createdAt:'2026-10-13T00:00:00Z',finishedAt:'2026-10-13T00:00:02Z',events:[{at:'2026-10-13T00:00:00Z',event:'accepted'}],output:'x'.repeat(20000),code:'private source',image:{reference:'python:test',id:'sha256:'+'b'.repeat(64),digests:[]}};
  const imported=validateProgress({...fresh(),version:3,labRuns:[run,run,{...run,id:'broken'},{...run,id:'c'.repeat(32),state:'running'}]});
  assert.equal(imported.version,4); assert.equal(imported.labRuns.length,1);
  assert.equal(imported.attempts.length,0); assert.equal(imported.labRuns[0].passed,false);
  assert.equal(imported.labRuns[0].output.length,16500); assert.equal(imported.labRuns[0].code,undefined);
  assert.equal(cleanRun({...run,state:'invented'}),null);
});
