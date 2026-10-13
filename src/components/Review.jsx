import { ArrowRight, Repeat2 } from 'lucide-react';
import { conceptReviews, status } from '../lib/progress.mjs';
export default function Review({ missions, progress, openMission }) {
  const rows = conceptReviews(progress, missions);
  const changed = missions.filter(m => status(progress, m) === 'Update available');
  return <>
    <div className="eyebrow">PRACTICE THAT TRAVELS</div>
    <h1>Make the idea stick.</h1>
    <p className="lede">Revisit a concept, then apply it to a different problem. A repeated solution and a successful transfer are different evidence.</p>
    <div className="review-summary panel"><Repeat2 className="accent"/><div><strong>{rows.filter(r => r.due).length} concepts ready to revisit</strong><p>Helped or unsuccessful attempts return after 1 day. Consecutive independent passes extend review to 3, 7, 14, then 30 days.</p></div></div>
    {changed.map(m => <article key={m.id} className="panel journal"><h3>{m.title} has new content</h3><p>Your earlier work is kept in the portfolio. Complete version {m.version} to refresh this evidence.</p><button onClick={() => openMission(m.id)}>Explore updated mission</button></article>)}
    {!rows.length && <div className="panel empty"><h2>Your first attempt starts the review queue.</h2><p>Choose a mission and submit its checks. You can review at any time.</p><button className="primary" onClick={() => openMission(missions[0].id)}>Start practicing</button></div>}
    <div className="cards">{rows.map(r => <article className="panel review-card" key={r.concept}>
      <span className={`tag ${r.due ? 'lime' : ''}`}>{r.due ? 'READY TO REVISIT' : `NEXT · ${new Date(r.dueAt).toLocaleDateString()}`}</span>
      <h2>{r.title}</h2><p>{r.lastResult}</p><strong className="evidence-label">{r.evidence}</strong>
      <p>{r.independent.length} distinct mission{r.independent.length === 1 ? '' : 's'} completed independently.</p>
      <button onClick={() => openMission(r.mission.id)}>{r.mission.transferOf && !r.independent.includes(r.mission.id) ? 'Try the transfer' : 'Practice again'} <ArrowRight size={16}/></button>
      <small>{r.mission.id} · {r.mission.title}</small>
    </article>)}</div>
    <p className="footnote">This is a simple scheduling heuristic, not a mastery score. Dates and evidence travel with your progress export. Old content versions remain in the portfolio.</p>
  </>;
}
