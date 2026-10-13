import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fresh, makeAttempt, validateProgress } from '../src/lib/progress.mjs';
import { createPlan, planComplete, localDay, practiceDays } from '../src/lib/planner.mjs';
import { stageEvidence, journalMarkdown } from '../src/lib/journal.mjs';
const missions = JSON.parse(readFileSync(new URL('../src/data/missions.json',import.meta.url)));
const now = new Date(2026, 9, 13, 9, 0);
test('daily plan fits each time budget and respects prerequisites', () => {
  for (const budget of [15,30,60]) {
    const p = fresh(), plan = createPlan(missions,p,budget,now);
    assert.ok(plan.items.reduce((n,x) => n+x.minutes,0) <= budget);
    assert.equal(plan.date,localDay(now));
    assert.equal(plan.items.find(x => x.kind === 'mission').missionId,'M01');
    assert.ok(!plan.items.some(x => x.missionId === 'M20'));
  }
});
test('daily completion requires evidence saved after the plan starts', () => {
  const p = fresh(), plan = createPlan(missions,p,30,now), item = plan.items[0];
  const a = makeAttempt(missions[0],true,0,'browser simulation');
  p.attempts = [{...a,at:new Date(now.getTime()-1000).toISOString()}];
  assert.equal(planComplete(item,plan,p),false);
  p.attempts.push({...a,at:new Date(now.getTime()+1000).toISOString()});
  assert.equal(planComplete(item,plan,p),true);
  const handoff = plan.items.find(x => x.kind === 'handoff');
  p.notes.M01 = 'Evidence before changes';
  assert.equal(planComplete(handoff,plan,p),false);
  p.noteTimes.M01 = new Date(now.getTime()+2000).toISOString();
  assert.equal(planComplete(handoff,plan,p),true);
  const week = practiceDays(p,now);assert.equal(week.length,7);assert.equal(week.at(-1).practiced,true);
});
test('guided incident evidence survives migration and export without falsely verifying a repair', () => {
  const p = fresh(), m=missions[0];
  p.incidents.M01={version:1,updatedAt:now.toISOString(),observation:'Service is stopped',hypothesis:'Configuration is stale',change:'Restarted it',verification:'Checked running state'};
  p.notes.M01='Leave a handoff';
  let stages=stageEvidence(m,p.incidents.M01,p.attempts,p.notes.M01);
  assert.deepEqual(stages.map(s=>s.done),[true,true,false,true]);
  p.attempts.push(makeAttempt(m,true,0,'browser simulation'),makeAttempt(m,false,0,'browser simulation'));
  stages=stageEvidence(m,p.incidents.M01,p.attempts,p.notes.M01);assert.equal(stages[2].done,false);
  p.dailyPlan=createPlan(missions,p,30,now);
  const clean=validateProgress(p);assert.deepEqual(clean.incidents,p.incidents);assert.deepEqual(clean.dailyPlan,p.dailyPlan);
  assert.match(journalMarkdown(missions,clean),/Configuration is stale/);
  assert.equal(stageEvidence({...m,version:2},clean.incidents.M01,[],null)[0].done,false);
  const old=validateProgress({version:2,attempts:[],notes:{M01:'Keep'},drafts:{},designs:[]});
  assert.equal(old.version,4);assert.equal(old.notes.M01,'Keep');
});
test('imports bound structured fields and discard invalid plans', () => {
  const p=fresh();p.incidents.M01={version:1,observation:'x'.repeat(7000)};
  p.dailyPlan={date:localDay(now),createdAt:now.toISOString(),budget:15,items:[{kind:'design',minutes:60}]};
  const clean=validateProgress(p);assert.equal(clean.incidents.M01.observation.length,5000);assert.equal(clean.dailyPlan,null);
});
