import { runLabel, TERMINAL } from '../lib/jobs.mjs';
export default function RunRecord({run,compact=false}) {
  return <div className="run-record">
    <strong>{runLabel(run.state)}</strong><span className="tag">{run.missionId} · v{run.missionVersion}</span>
    <small>{new Date(run.createdAt).toLocaleString()} · {TERMINAL.includes(run.state) ? `Cleanup ${run.cleanup}` : '10-second execution limit'}</small>
    {run.cleanup==='pending' && TERMINAL.includes(run.state) && <p className="warning">Container removal has not been confirmed. The runner will retry expired-container cleanup when Docker is reachable.</p>}
    {run.image && <details><summary>Image and run identity</summary><p>Run <code>{run.id}</code></p><p>{run.image.reference}</p><code>{run.image.id}</code>{run.image.digests.map(d=><p key={d}><code>{d}</code></p>)}</details>}
    {!compact && <details><summary>Lifecycle events</summary><ol>{run.events.map((e,i)=><li key={i}>{new Date(e.at).toLocaleTimeString()} · {e.event.replaceAll('_',' ')}</li>)}</ol></details>}
    {!compact && run.output && <details><summary>Saved execution output</summary><pre>{run.output}</pre></details>}
  </div>;
}
