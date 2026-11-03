import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,validateProgress} from '../src/lib/progress.mjs';
import {mergeGuestProgress,accountKey} from '../src/lib/account.mjs';
import {cleanRun} from '../src/lib/jobs.mjs';
import {stageEvidence} from '../src/lib/journal.mjs';

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

const attempt = (id, at, passed=true) => ({id,at,passed,missionId:'M01',missionVersion:1,concepts:[],mode:'browser simulation',hints:0});
test('guest import orders attempt evidence chronologically without mutating either workspace',()=>{
  const account=fresh(), guest=fresh();
  account.attempts=[attempt('old','2026-10-01T00:00:00Z')];
  guest.attempts=[attempt('new','2026-10-03T00:00:00Z',false),attempt('middle','2026-10-02T00:00:00Z')];
  const before=JSON.stringify({account,guest});
  const merged=mergeGuestProgress(account,guest);
  assert.deepEqual(merged.attempts.map(x=>x.id),['old','middle','new']);
  assert.equal(merged.attempts.at(-1).passed,false);
  assert.equal(stageEvidence({id:'M01',version:1},null,merged.attempts,'')[2].done,false);
  assert.equal(JSON.stringify({account,guest}),before);
  assert.deepEqual(mergeGuestProgress(merged,guest),merged);
});
test('bounded guest import retains the newest attempts rather than preferring old account entries',()=>{
  const account=fresh(), guest=fresh();
  account.attempts=Array.from({length:10000},(_,i)=>attempt(`old-${i}`,new Date(Date.UTC(2026,0,1)+i*1000).toISOString()));
  guest.attempts=[attempt('new','2026-10-03T00:00:00Z')];
  const merged=mergeGuestProgress(account,guest);
  assert.equal(merged.attempts.length,10000);
  assert.equal(merged.attempts[0].id,'old-1');
  assert.equal(merged.attempts.at(-1).id,'new');
});
test('account duplicate wins before sorting, including equal timestamps',()=>{
  const account=fresh(), guest=fresh(), at='2026-10-03T00:00:00Z';
  account.attempts=[attempt('duplicate',at,false)];
  guest.attempts=[attempt('duplicate','2026-10-04T00:00:00Z'),attempt('equal',at)];
  const merged=mergeGuestProgress(account,guest);
  assert.equal(merged.attempts.length,2);
  assert.equal(merged.attempts.find(x=>x.id==='duplicate').passed,false);
  assert.equal(merged.attempts.find(x=>x.id==='duplicate').at,at);
  assert.deepEqual(mergeGuestProgress(merged,guest),merged);
});
test('design retention orders legacy invalid dates first and retains recent guest work',()=>{
  const account=fresh(), guest=fresh();
  account.designs=Array.from({length:100},(_,i)=>({at:new Date(Date.UTC(2026,0,1)+i*1000).toISOString(),name:`old-${i}`,rationale:'Account',config:{}}));
  account.designs[0].at='invalid legacy date';
  guest.designs=[{at:'2026-10-03T00:00:00Z',name:'New',rationale:'Guest',config:{}}];
  const merged=mergeGuestProgress(account,guest);
  assert.equal(merged.designs.length,100);
  assert.equal(merged.designs[0].name,'old-1');
  assert.equal(merged.designs.at(-1).name,'New');
});
test('managed-run retention uses creation time and preserves the account duplicate',()=>{
  const run=(i,createdAt)=>({id:i.toString(16).padStart(32,'0'),missionId:'M07',missionVersion:1,state:'failed',passed:false,cleanup:'confirmed',createdAt,finishedAt:'2026-10-04T00:00:00Z',events:[],output:''});
  const account=fresh(), guest=fresh();
  account.labRuns=Array.from({length:100},(_,i)=>run(i,new Date(Date.UTC(2026,0,1)+i*1000).toISOString()));
  guest.labRuns=[run(100,'2026-10-03T00:00:00Z'),{...account.labRuns[50],output:'Guest duplicate'}];
  const merged=mergeGuestProgress(account,guest);
  assert.equal(merged.labRuns.length,100);
  assert.equal(merged.labRuns[0].id,account.labRuns[1].id);
  assert.equal(merged.labRuns.at(-1).id,guest.labRuns[0].id);
  assert.equal(merged.labRuns.find(x=>x.id===account.labRuns[50].id).output,'');
});
