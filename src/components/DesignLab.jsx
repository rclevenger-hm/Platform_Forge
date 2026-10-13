import { useState } from 'react';
import { Save, Activity, Server, Database, Play, Pin } from 'lucide-react';
import { defaultGraph, designDefaults, cleanDesignConfig, simulateDesign, SCENARIOS, withQueue } from '../lib/architecture.mjs';
import ArchitectureCanvas from './ArchitectureCanvas';
const initialDraft = () => ({config:{...designDefaults}, graph:defaultGraph(), rationale:'', name:'Relay architecture experiment', baseline:null});
const jobs = value => Math.round(value).toLocaleString();
const latency = s => s.p95 === null ? 'Unstable' : `${s.p95} ms`;
export default function DesignLab({ progress, setProgress }) {
  const [draft,setDraft] = useState(() => progress.designDraft || initialDraft()), [saved,setSaved] = useState(false), [scenarioResults,setScenarioResults] = useState(null);
  const {graph,rationale,name,baseline} = draft, config = cleanDesignConfig(draft.config);
  const s = simulateDesign(config,graph), before = baseline ? simulateDesign(baseline.config,baseline.graph) : null;
  function change(partial) {
    const next = {...draft,...partial};setDraft(next);setProgress(p => ({...p,designDraft:next}));setSaved(false);setScenarioResults(null);
  }
  function update(key,value) { change({config:cleanDesignConfig({...config,[key]:value})}); }
  const ranges = [
    ['traffic','Incoming traffic',100,10000,100,'req/s'],['nodes','API replicas',1,10,1,''],
    ['cache','Cache hit rate',0,95,5,'%'],['db','Database capacity',100,3000,100,'ops/s'],
  ];
  const jobRanges = [['jobs','Background job arrivals',0,3000,50,'jobs/s'],['workers','Worker replicas',1,10,1,''],['queueLimit','Queue buffer',100,10000,100,'jobs'],['initialBacklog','Starting backlog',0,config.queueLimit,100,'jobs'],['seconds','Scenario duration',10,300,10,'sec']];
  const slider = ([key,label,min,max,step,unit]) => <label className="slider" key={key}><span>{label}<strong>{config[key]} {unit}</strong></span><input aria-label={label} type="range" min={min} max={max} step={step} value={config[key]} onChange={e => update(key,Number(e.target.value))}/></label>;
  return <>
    <div className="eyebrow">DRAW / BREAK / COMPARE / EXPLAIN</div><h1>Design for the unexpected.</h1>
    <p className="lede">Build a request path. Add background work. Change the conditions and use the evidence to defend your tradeoffs.</p>
    <div className="design-layout">
      <section className="panel controls"><h2>Scenario controls</h2>{ranges.map(slider)}
        <label className="toggle"><input type="checkbox" checked={config.failed} onChange={e => update('failed',e.target.checked)}/>Inject one API replica failure</label>
        <label className="toggle"><input type="checkbox" checked={config.dbFailed} onChange={e => update('dbFailed',e.target.checked)}/>Make the database unavailable</label>
        <details open={graph.nodes.some(n => n.id === 'queue')}><summary>Background work</summary>{jobRanges.map(slider)}
          <label className="toggle"><input type="checkbox" checked={config.workerFailed} onChange={e => update('workerFailed',e.target.checked)}/>Stop all workers</label>
        </details>
        <button onClick={() => change(initialDraft())}>Reset scenario</button>
      </section>
      <section className="panel architecture">
        <div className="section-title"><h2>Relay architecture</h2><span className={`tag ${s.overloaded ? 'amber' : 'lime'}`}>{s.overloaded ? 'OVER CAPACITY' : 'WITHIN CAPACITY'}</span></div>
        <ArchitectureCanvas graph={graph} config={config} onChange={graph => change({graph})}/>
        <div className="toolbar"><button onClick={() => change({graph:withQueue(graph),config:{...config,jobs:config.jobs || 250}})}>Add queue & worker path</button><button onClick={() => change({baseline:{config:{...config},graph:structuredClone(graph)}})}><Pin size={15}/>{baseline ? 'Replace baseline' : 'Pin baseline'}</button></div>
        {!!s.diagnostics.length && <div className="topology-diagnostics" role="status"><strong>Check your design</strong><ul>{s.diagnostics.map(d => <li key={d}>{d}</li>)}</ul></div>}
        <div className="stats compact"><div><Activity/><strong>{latency(s)}</strong><span>Illustrative foreground p95</span></div><div><Server/><strong>{s.active} / {s.nodes}</strong><span>Active API replicas</span></div><div><Database/><strong>{s.dbTraffic}</strong><span>Offered DB reads / sec</span></div></div>
      </section>
    </div>
    <div className="cards design-results">
      <div className="panel"><h3>Capacity pressure</h3><strong className="big-number">{Number.isFinite(s.utilization) ? Math.round(s.utilization*100) : '∞'}%</strong><p>{s.bottleneck} is the limiting resource. {s.overloaded ? 'Foreground arrivals reach or exceed effective capacity.' : 'The foreground request path has spare capacity.'}</p></div>
      <div className="panel"><h3>Rejected foreground traffic</h3><strong className="big-number">{s.error.toFixed(1)}%</strong><p>Requests above capacity or on a broken route. The queue metrics below describe separate background jobs.</p></div>
      <div className="panel"><h3>Relative cost</h3><strong className="big-number">{s.cost}<small> units</small></strong><p>Provisioned components have a cost even when disconnected. These weights are illustrative, not cloud prices.</p></div>
    </div>
    {(s.queue.enabled || config.jobs > 0) && <section className="panel queue-results"><div className="section-title"><h2>What happens to the queue?</h2><span className="tag">{config.seconds}-SECOND EXPERIMENT</span></div>
      <div className="queue-metrics">{[['Jobs processed',s.queue.processed],['Jobs left in queue',s.queue.backlog],['Jobs rejected',s.queue.rejected],['Drain capacity',`${s.queue.drainRate.toFixed(0)} jobs/s`]].map(([label,value]) => <div key={label}><strong>{typeof value === 'number' ? jobs(value) : value}</strong><span>{label}</span></div>)}</div>
      <p>{s.queue.drainSeconds === null ? 'The remaining jobs cannot drain under these conditions.' : `If new jobs stop, the remaining backlog drains in about ${s.queue.drainSeconds} seconds.`} Foreground database reads take priority; each processed job consumes one database operation.</p>
    </section>}
    {before && <section className="panel baseline-comparison"><h2>Baseline → current design</h2><div className="table-wrap"><table><thead><tr><th>Evidence</th><th>Pinned baseline</th><th>Current</th></tr></thead><tbody>
      {[['Foreground p95',latency(before),latency(s)],['Rejected requests',`${before.error.toFixed(1)}%`,`${s.error.toFixed(1)}%`],['Queued jobs',before.queue.backlog,s.queue.backlog],['Rejected jobs',before.queue.rejected,s.queue.rejected],['Relative cost',before.cost,s.cost]].map(([label,a,b]) => <tr key={label}><th scope="row">{label}</th><td>{a}</td><td>{b}</td></tr>)}
    </tbody></table></div><small>The baseline is a snapshot. Moving a component changes its layout; connecting it changes the modeled behavior.</small></section>}
    <section className="panel scenario-suite"><div className="section-title"><div><span className="eyebrow">CHALLENGE YOUR ASSUMPTIONS</span><h2>Run the failure scenarios</h2></div><button className="primary" onClick={() => setScenarioResults(SCENARIOS.map(scenario => ({title:scenario.title,result:simulateDesign(scenario.change(config),graph)})))}><Play size={16}/>Run scenario suite</button></div>
      <p>Compare your current design with a traffic spike, API loss, cold cache, and stopped workers. Values stay within the controls’ stated limits.</p>
      {scenarioResults && <div className="table-wrap"><table><thead><tr><th>Scenario</th><th>Foreground p95</th><th>Rejected requests</th><th>Queued jobs</th><th>Rejected jobs</th></tr></thead><tbody>{scenarioResults.map(({title,result:r}) => <tr key={title}><th scope="row">{title}</th><td>{latency(r)}</td><td>{r.error.toFixed(1)}%</td><td>{jobs(r.queue.backlog)}</td><td>{jobs(r.queue.rejected)}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="panel"><h2>Defend your decision</h2><label className="design-name">Experiment name<input aria-label="Experiment name" maxLength={150} value={name} onChange={e => change({name:e.target.value})}/></label><p>Which connection or bottleneck mattered? What did the baseline miss? How would you validate these assumptions with real measurements?</p>
      <textarea aria-label="Design rationale" maxLength={10000} value={rationale} onChange={e => change({rationale:e.target.value})} placeholder="My design trades…"/>
      <button className="primary" disabled={!rationale.trim() || !name.trim() || saved} onClick={() => {
        setProgress(p => ({...p,designs:[...p.designs,{name:name.trim(),rationale,config,graph,baseline,modelVersion:1,at:new Date().toISOString()}].slice(-100)}));setSaved(true);
      }}><Save size={16}/>{saved ? 'Saved to portfolio' : 'Save experiment'}</button>
    </section>
    <details className="model-notes"><summary>Model assumptions and equations</summary>
      <p>Each API replica supplies 600 requests/s. Connected cache hits bypass database reads; database availability is still required. Foreground capacity is min(active API replicas × 600, database capacity ÷ cache miss fraction). A broken request path has zero capacity. At or above capacity, latency is unstable. Below capacity, illustrative p95 = 30 + 1000 × −ln(0.05) ÷ (capacity − traffic) milliseconds.</p>
      <p>Background job arrival is an independent input at the queue. Each worker supplies up to 300 jobs/s; each job needs one database operation. Reads take priority. Job drain capacity = min(active workers × 300, unused database operations/s). Over the chosen duration, jobs are processed, retained up to buffer capacity, or rejected. A missing enqueue path rejects arriving jobs; existing queued jobs can still drain through connected workers. The initial backlog and new arrivals are conserved.</p>
      <p>The model uses constant rates and a fluid queue approximation. It omits bursts within the interval, cache warmup, retries, acknowledgement latency, replication, and actual process scheduling. Canvas positions have no performance effect. Results support reasoning and are not production benchmarks.</p>
    </details>
  </>;
}
