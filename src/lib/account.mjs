import { fresh, validateProgress } from './progress.mjs';
export const BACKEND_KEY = 'platform-forge:backend';
export const accountKey = (url, id) => `platform-forge:account:${encodeURIComponent(url || location.origin)}:${id}`;
export function mergeGuestProgress(account, guest) {
  const a = validateProgress(account), g = validateProgress(guest);
  return validateProgress({...fresh(), ...a,
    attempts: [...new Map([...g.attempts, ...a.attempts].map(x => [x.id, x])).values()].slice(-10000),
    notes: {...g.notes, ...a.notes}, drafts: {...g.drafts, ...a.drafts},
    incidents: {...g.incidents, ...a.incidents}, noteTimes: {...g.noteTimes, ...a.noteTimes},
    designs: [...new Map([...g.designs, ...a.designs].map(x => [`${x.at}:${x.name}`, x])).values()].slice(-100),
    labRuns: [...new Map([...(g.labRuns || []), ...(a.labRuns || [])].map(x => [x.id, x])).values()].slice(-100),
    designDraft: a.designDraft || g.designDraft, authorDraft: a.authorDraft || g.authorDraft,
  });
}
export function downloadProgress(progress, name='platform-forge-device-backup.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(progress,null,2)],{type:'application/json'}));
  const a = document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
