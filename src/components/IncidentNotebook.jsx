import { JOURNAL_FIELDS } from '../lib/journal.mjs';
const prompts = {
  observation:['What did you observe?', 'Quote a symptom, log line, input or failed check. Separate observation from interpretation.'],
  hypothesis:['What might explain it?', 'Make a testable prediction. What result would disprove your explanation?'],
  change:['What did you change?', 'Describe the smallest repair and how you would undo it.'],
  verification:['How did you verify it?', 'Explain which checks support the fix and what they cannot establish.'],
};
export default function IncidentNotebook({mission, progress, setProgress}) {
  const record = progress.incidents?.[mission.id];
  const old = record && record.version !== mission.version;
  return <section className="panel incident-notebook">
    <span className="eyebrow">THINK LIKE AN OPERATOR</span><h2>Incident notebook</h2>
    <p>Keep the reasoning as you work. A useful hypothesis can be wrong.</p>
    {old && <p className="warning">These notes describe version {record.version}. Review and edit them to adopt the current lesson version.</p>}
    {JOURNAL_FIELDS.map(key => <label key={key}>
      <strong>{prompts[key][0]}</strong>
      <textarea aria-label={`Incident ${key}`} maxLength={5000} value={record?.[key] || ''} placeholder={prompts[key][1]} onChange={e => {
        const value = e.target.value;
        setProgress(p => ({...p, incidents:{...p.incidents, [mission.id]:{...p.incidents?.[mission.id], version:mission.version, [key]:value, updatedAt:new Date().toISOString()}}}));
      }}/>
    </label>)}
    <small>Saved on this device. Portfolio exports include these notes.</small>
  </section>;
}
