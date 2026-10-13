import { conceptReviews, nextMission, prerequisitesMissing, status } from './progress.mjs';
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function createPlan(missions, progress, budget = 30, now = new Date()) {
  budget = [15, 30, 60].includes(budget) ? budget : 30;
  const due = conceptReviews(progress, missions, now.getTime()).filter(r => r.due);
  const next = nextMission(missions, progress);
  const candidates = [...due.map(r => r.mission), next, ...missions.filter(m => status(progress, m) === 'Not started')]
    .filter((m, i, a) => m && a.findIndex(x => x?.id === m.id) === i && !prerequisitesMissing(m, missions, progress).length);
  const items = []; let remaining = budget;
  for (const m of candidates) {
    if (m.minutes > remaining || items.length >= 3) continue;
    items.push({kind:'mission', missionId:m.id, version:m.version, minutes:m.minutes, reason:due.some(r => r.mission.id === m.id) ? 'Revisit a due concept' : m.transferOf ? 'Apply an idea to a new problem' : 'Build your foundation'});
    remaining -= m.minutes;
  }
  if (!items.length && next) {
    items.push({kind:'observe', missionId:next.id, version:next.version, minutes:5, reason:'Read the briefing and record an observation. Finish the repair another time.'});
    remaining -= 5;
  }
  const first = items[0];
  if (first && remaining >= 3) {
    items.push({kind:'handoff', missionId:first.missionId, version:first.version, minutes:3, reason:'Explain what you learned in a handoff note'}); remaining -= 3;
  }
  if (remaining >= 10) items.push({kind:'design', minutes:10, reason:'Change one assumption and save your design rationale'});
  return {date:localDay(now), budget, createdAt:now.toISOString(), items};
}
export function planComplete(item, plan, progress) {
  const since = value => Number.isFinite(Date.parse(value)) && Date.parse(value) >= Date.parse(plan.createdAt);
  if (item.kind === 'design') return progress.designs.some(d => since(d.at));
  if (item.kind === 'handoff') return !!progress.notes[item.missionId]?.trim() && since(progress.noteTimes?.[item.missionId]);
  if (item.kind === 'observe') {
    const r = progress.incidents?.[item.missionId];
    return r?.version === item.version && !!r.observation?.trim() && since(r.updatedAt);
  }
  return progress.attempts.some(a => a.missionId === item.missionId && (a.missionVersion ?? 1) === item.version && a.passed && since(a.at));
}
export function practiceDays(progress, now = new Date()) {
  const days = new Set([...progress.attempts, ...progress.designs].map(a => localDay(new Date(a.at))));
  return Array.from({length:7}, (_,i) => {
    const d = new Date(now); d.setDate(d.getDate() - 6 + i);
    return {date:localDay(d), label:d.toLocaleDateString(undefined, {weekday:'short'}), practiced:days.has(localDay(d))};
  });
}
