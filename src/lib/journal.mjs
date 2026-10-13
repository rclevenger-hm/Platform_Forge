export const JOURNAL_FIELDS = ['observation', 'hypothesis', 'change', 'verification'];
export function cleanJournal(value) {
  if (!value || typeof value !== 'object' || !Number.isInteger(value.version) || value.version < 1) return null;
  const result = {version:value.version, updatedAt:Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : ''};
  for (const key of JOURNAL_FIELDS) result[key] = typeof value[key] === 'string' ? value[key].slice(0, 5000) : '';
  return result;
}
export function stageEvidence(mission, record, attempts, note) {
  const current = record?.version === mission.version ? record : {};
  const last = attempts.filter(a => a.missionId === mission.id && (a.missionVersion ?? 1) === mission.version).at(-1);
  return [
    {name:'Observe', target:'briefing', done:!!current.observation?.trim() && !!current.hypothesis?.trim(), detail:'Observation and hypothesis recorded'},
    {name:'Repair', target:'workspace', done:!!current.change?.trim(), detail:'Change recorded'},
    {name:'Verify', target:'checks', done:last?.passed === true, detail:'Latest submitted checks pass'},
    {name:'Explain', target:'handoff', done:!!note?.trim() && !!current.verification?.trim(), detail:'Verification rationale and handoff recorded'},
  ];
}
export function journalMarkdown(missions, progress) {
  const blocks = ['# Platform Forge engineering journal', '', 'Self-study evidence; not a proctored assessment.', ''];
  for (const mission of missions) {
    const r = progress.incidents?.[mission.id];
    const note = progress.notes[mission.id];
    if (!r && !note) continue;
    blocks.push(`## ${mission.id} · ${mission.title}`, '', `Content version: ${r?.version ?? mission.version}`, '');
    for (const field of JOURNAL_FIELDS) if (r?.[field]) blocks.push(`### ${field[0].toUpperCase() + field.slice(1)}`, '', r[field], '');
    if (note) blocks.push('### Handoff', '', note, '');
  }
  return blocks.join('\n');
}
