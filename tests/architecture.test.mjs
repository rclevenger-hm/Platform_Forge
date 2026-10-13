import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultGraph, designDefaults, simulateDesign, cleanGraph, withQueue, removeComponent, SCENARIOS } from '../src/lib/architecture.mjs';
import { fresh, validateProgress } from '../src/lib/progress.mjs';
test('topology connections determine cache effectiveness and request reachability', () => {
  const graph=defaultGraph(), normal=simulateDesign(designDefaults,graph);
  assert.equal(normal.overloaded,false);assert.equal(normal.cacheConnected,true);
  const noCache=simulateDesign(designDefaults,removeComponent(graph,'cache'));
  assert.equal(noCache.cache,0);assert.equal(noCache.overloaded,true);
  const noDb=simulateDesign(designDefaults,removeComponent(graph,'database'));
  assert.equal(noDb.capacity,0);assert.equal(noDb.error,100);assert.equal(noDb.p95,null);
  const moved=structuredClone(graph);moved.nodes[0].x=20;
  assert.equal(simulateDesign(designDefaults,moved).capacity,normal.capacity);
});
test('bounded queue conserves jobs across normal, saturated and failed conditions', () => {
  const graph=withQueue(defaultGraph());
  for (const change of [{},{workerFailed:true},{dbFailed:true},{jobs:3000},{traffic:10000},{failed:true,nodes:1}]) {
    const s=simulateDesign({...designDefaults,jobs:250,initialBacklog:100,...change},graph), q=s.queue;
    assert.ok(Math.abs(s.config.initialBacklog+q.arrivals-q.processed-q.rejected-q.backlog)<0.001);
    assert.ok(q.backlog<=s.config.queueLimit);assert.ok(q.processed>=0);assert.ok(q.rejected>=0);
  }
  const normal=simulateDesign({...designDefaults,jobs:250},graph);
  assert.equal(normal.queue.backlog,0);assert.equal(normal.queue.rejected,0);
  const stopped=simulateDesign({...designDefaults,jobs:250,workerFailed:true},graph);
  assert.equal(stopped.queue.backlog,1000);assert.equal(stopped.queue.rejected,14000);assert.equal(stopped.queue.drainSeconds,null);
});
test('existing backlog drains even when the API cannot enqueue new work', () => {
  const graph=withQueue(defaultGraph());
  graph.edges=graph.edges.filter(e => !(e.from==='api' && e.to==='queue'));
  const s=simulateDesign({...designDefaults,jobs:250,initialBacklog:200},graph);
  assert.equal(s.queue.processed,200);assert.equal(s.queue.rejected,15000);assert.equal(s.queue.backlog,0);
});
test('graph imports reject invalid topology and preserve valid experiments with baselines', () => {
  const graph=defaultGraph();
  assert.throws(()=>cleanGraph({...graph,nodes:[...graph.nodes,graph.nodes[0]]}),/duplicate/);
  assert.throws(()=>cleanGraph({...graph,edges:[...graph.edges,{from:'api',to:'clients'}]}),/Unsupported/);
  const p=fresh();p.designDraft={config:designDefaults,graph,rationale:'Capacity reserve',name:'Experiment',baseline:{config:designDefaults,graph}};
  p.designs=[{...p.designDraft,at:'2026-10-13T00:00:00Z',modelVersion:1}];
  const clean=validateProgress(p);assert.deepEqual(clean.designDraft,p.designDraft);assert.deepEqual(clean.designs,p.designs);
  p.designDraft.graph={version:500};assert.equal(validateProgress(p).designDraft,null);
  assert.equal(SCENARIOS.length,5);
});
