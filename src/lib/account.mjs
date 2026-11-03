import { fresh, validateProgress } from './progress.mjs';
export const BACKEND_KEY = 'platform-forge:backend';
export const accountKey = (url, id) => `platform-forge:account:${encodeURIComponent(url || location.origin)}:${id}`;
// Deduplicate before sorting so the account copy still wins conflicting IDs.
// Invalid legacy design dates sort oldest; they must not evict dated evidence.
function mergeEvidence(guest, account, key, date, limit) {
  const timestamp = value => Number.isFinite(Date.parse(date(value))) ? Date.parse(date(value)) : -Infinity;
  return [...new Map([...guest, ...account].map(value => [key(value), value])).values()]
    .sort((a, b) => timestamp(a) - timestamp(b)).slice(-limit);
}
export function mergeGuestProgress(account, guest) {
  const a = validateProgress(account), g = validateProgress(guest);
  return validateProgress({...fresh(), ...a,
    attempts: mergeEvidence(g.attempts, a.attempts, x => x.id, x => x.at, 10000),
    notes: {...g.notes, ...a.notes}, drafts: {...g.drafts, ...a.drafts},
    incidents: {...g.incidents, ...a.incidents}, noteTimes: {...g.noteTimes, ...a.noteTimes},
    designs: mergeEvidence(g.designs, a.designs, x => `${x.at}:${x.name}`, x => x.at, 100),
    labRuns: mergeEvidence(g.labRuns, a.labRuns, x => x.id, x => x.createdAt, 100),
    designDraft: a.designDraft || g.designDraft, authorDraft: a.authorDraft || g.authorDraft,
  });
}
export function downloadProgress(progress, name='platform-forge-device-backup.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(progress,null,2)],{type:'application/json'}));
  const a = document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
