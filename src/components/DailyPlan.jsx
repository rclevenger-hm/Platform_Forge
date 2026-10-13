import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { createPlan, localDay, planComplete, practiceDays } from '../lib/planner.mjs';
export default function DailyPlan({missions, progress, setProgress, openMission, navigate}) {
  const [day, setDay] = useState(() => localDay());
  useEffect(() => { const timer = setInterval(() => setDay(localDay()), 30000); return () => clearInterval(timer); }, []);
  const obsolete = progress.dailyPlan?.items.some(item => item.kind !== "design" && !missions.some(m => m.id === item.missionId && m.version === item.version));
  useEffect(() => {
    if (progress.dailyPlan?.date !== day || obsolete) setProgress(p => ({...p, dailyPlan:createPlan(missions, p, p.dailyPlan?.budget || 30)}));
  }, [day, missions, progress.dailyPlan?.date, obsolete, setProgress]);
  const plan = progress.dailyPlan?.date === day ? progress.dailyPlan : null;
  const days = practiceDays(progress);
  if (!plan) return <aside className="panel daily-plan">Preparing your practice plan…</aside>;
  const done = plan.items.filter(item => planComplete(item, plan, progress)).length;
  return <aside className="panel daily-plan" aria-label="Today's practice plan">
    <div className="eyebrow">ONE USEFUL SESSION</div><h2>Today's plan</h2>
    <label className="budget-label">Time available<select aria-label="Daily time budget" value={plan.budget} onChange={e => {
      const budget = Number(e.target.value); setProgress(p => ({...p, dailyPlan:createPlan(missions,p,budget)}));
    }}>{[15,30,60].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
    <ol className="plan-list">{plan.items.map((item,i) => {
      const m = missions.find(m => m.id === item.missionId), complete = planComplete(item,plan,progress);
      const title = item.kind === 'handoff' ? 'Leave a clear handoff' : item.kind === 'observe' ? `Investigate ${m?.title || item.missionId}` : item.kind === 'design' ? 'Test a design tradeoff' : m?.title || item.missionId;
      return <li key={`${item.kind}-${item.missionId || i}`} className={complete ? 'done' : ''}>
        {complete ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
        <button className="plan-task" onClick={() => item.kind === 'design' ? navigate('Design Lab') : openMission(item.missionId)}>
          <strong>{title}</strong><span>{item.reason}</span><small>{complete ? 'Evidence recorded' : `About ${item.minutes} min`} <ArrowRight size={12}/></small>
        </button>
      </li>;
    })}</ol>
    <div className="plan-progress"><span>{done} / {plan.items.length} steps complete</span><progress aria-label="Daily plan completion" value={done} max={plan.items.length || 1}/></div>
    <div className="practice-week" aria-label="Practice in the past seven days">{days.map(d => <span key={d.date} title={`${d.date}: ${d.practiced ? 'practice recorded' : 'no recorded practice'}`} className={d.practiced ? 'practiced' : ''}>{d.label.slice(0,1)}<span className="sr-only"> {d.date} {d.practiced ? 'practiced' : 'no practice recorded'}</span></span>)}</div>
    <small>Estimates, not a timer. Work counts when you save evidence; breaks never erase progress.</small>
  </aside>;
}
