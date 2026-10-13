import { cleanRun } from "./jobs.mjs";
import { cleanGraph, cleanDesignConfig } from "./architecture.mjs";
import { cleanJournal } from "./journal.mjs";
import { CONCEPTS } from "./curriculum.mjs";
export const KEY = "platform-forge:v1";
export const fresh = () => ({
  version: 4,
  labRuns: [],
  attempts: [],
  notes: {},
  drafts: {},
  designs: [],
  authorDraft: "",
  dailyPlan: null,
  designDraft: null,
  incidents: {},
  noteTimes: {},
});
export function validateProgress(v) {
  if (
    !v ||
    ![1, 2, 3, 4].includes(v.version) ||
    !Array.isArray(v.attempts) ||
    v.attempts.length > 10000
  )
    throw Error("Not a supported Platform Forge progress file.");
  const clean = fresh();
  clean.labRuns = Array.isArray(v.labRuns) ? [...new Map(v.labRuns.slice(-100).map(x => cleanRun(x, true)).filter(Boolean).map(x => [x.id,x])).values()] : [];
  clean.attempts = v.attempts.map((a) => {
    if (
      !a ||
      (v.version >= 2 && (!Number.isInteger(a.missionVersion) || a.missionVersion < 1 || !Array.isArray(a.concepts) || a.concepts.length > 30 || !a.concepts.every(c => Object.hasOwn(CONCEPTS, c)))) ||
      typeof a.missionId !== "string" ||
      a.missionId.length > 80 ||
      !["browser simulation", "browser Python", "Docker lab"].includes(
        a.mode,
      ) ||
      typeof a.passed !== "boolean" ||
      !Number.isFinite(Date.parse(a.at)) ||
      !Number.isInteger(a.hints) ||
      a.hints < 0 ||
      a.hints > 10
    )
      throw Error("Invalid attempt record.");
    return {
      id: String(a.id).slice(0, 100),
      missionVersion: v.version === 1 ? 1 : a.missionVersion,
      concepts: v.version === 1 ? [] : [...new Set(a.concepts)],
      missionId: a.missionId,
      mode: a.mode,
      passed: a.passed,
      hints: a.hints,
      at: a.at,
    };
  });
  for (const key of ["notes", "drafts"]) {
    if (v[key] && typeof v[key] === "object" && !Array.isArray(v[key]))
      for (const [k, x] of Object.entries(v[key]).slice(0, 300))
        if (
          !["__proto__", "constructor", "prototype"].includes(k) &&
          typeof x === "string"
        )
          clean[key][k] = x.slice(0, 30000);
  }
  clean.designs = Array.isArray(v.designs)
    ? v.designs
        .slice(-100)
        .filter(
          (x) =>
            x && typeof x.name === "string" && typeof x.rationale === "string",
        )
        .map((x) => ({
          name: x.name.slice(0, 150),
          rationale: x.rationale.slice(0, 10000),
          at: String(x.at),
          config: safeConfig(x.config),
          ...(safeDesign(x) || {}),
        }))
    : [];
  clean.designDraft = safeDesign(v.designDraft, true);
  clean.authorDraft = typeof v.authorDraft === "string" ? v.authorDraft.slice(0, 250000) : "";
  for (const [id, value] of Object.entries(v.incidents && typeof v.incidents === "object" ? v.incidents : {}).slice(0, 300)) {
    const record = cleanJournal(value);
    if (/^[A-Z][A-Z0-9_-]{1,39}$/.test(id) && record) clean.incidents[id] = record;
  }
  for (const [id, at] of Object.entries(v.noteTimes && typeof v.noteTimes === "object" ? v.noteTimes : {}).slice(0, 300)) {
    if (/^[A-Z][A-Z0-9_-]{1,39}$/.test(id) && typeof at === "string" && Number.isFinite(Date.parse(at))) clean.noteTimes[id] = at;
  }
  const plan = v.dailyPlan;
  if (plan && /^\d{4}-\d{2}-\d{2}$/.test(plan.date) && [15, 30, 60].includes(plan.budget) && Number.isFinite(Date.parse(plan.createdAt)) && Array.isArray(plan.items) && plan.items.length <= 6) {
    const items = plan.items.filter(x => x && ["mission", "observe", "handoff", "design"].includes(x.kind) && Number.isInteger(x.minutes) && x.minutes > 0 && x.minutes <= 60 && (x.kind === "design" || (/^[A-Z][A-Z0-9_-]{1,39}$/.test(x.missionId) && Number.isInteger(x.version) && x.version > 0)))
      .map(x => ({kind:x.kind, ...(x.kind === "design" ? {} : {missionId:x.missionId, version:x.version}), minutes:x.minutes, reason:String(x.reason || "").slice(0,300)}));
    if (items.length === plan.items.length && items.reduce((n,x) => n + x.minutes, 0) <= plan.budget) clean.dailyPlan = {date:plan.date, budget:plan.budget, createdAt:plan.createdAt, items};
  }
  return clean;
}
function safeDesign(value, draft = false) {
  if (!value || !value.graph) return null;
  try {
    const graph = cleanGraph(value.graph), config = cleanDesignConfig(value.config);
    let baseline = null;
    if (value.baseline?.graph) {
      try { baseline = {graph:cleanGraph(value.baseline.graph),config:cleanDesignConfig(value.baseline.config)}; } catch { /* Keep valid current work if only the baseline is invalid. */ }
    }
    return {graph, config, baseline, ...(draft ? {name:typeof value.name === "string" ? value.name.slice(0,150) : "Relay architecture experiment", rationale:typeof value.rationale === "string" ? value.rationale.slice(0,10000) : ""} : {modelVersion:1})};
  } catch { return null; }
}
function safeConfig(c = {}) {
  return Object.fromEntries(
    Object.entries(c && typeof c === "object" ? c : {}).filter(
      ([k, v]) =>
        ["traffic", "nodes", "cache", "db", "failed"].includes(k) &&
        (typeof v === "boolean" || Number.isFinite(v)),
    ),
  );
}
export function readProgress(storage) {
  try {
    return validateProgress(JSON.parse(storage.getItem(KEY)));
  } catch {
    return fresh();
  }
}
export function status(progress, mission) {
  const id = typeof mission === "string" ? mission : mission.id;
  const all = progress.attempts.filter(x => x.missionId === id && x.passed);
  const current = typeof mission === "string" ? all : all.filter(x => (x.missionVersion ?? 1) === mission.version);
  return current.length ? current.some(x => x.hints === 0) ? "Independent pass" : "Completed with help" : all.length ? "Update available" : "Not started";
}
export function prerequisitesMissing(mission, missions, progress) {
  return mission.prerequisites.map(id => missions.find(m => m.id === id)).filter(m => m && !["Independent pass", "Completed with help"].includes(status(progress, m)));
}
export function nextMission(missions, progress) {
  return missions.find(m => ["Not started", "Update available"].includes(status(progress, m)) && !prerequisitesMissing(m, missions, progress).length)
    || missions.find(m => ["Not started", "Update available"].includes(status(progress, m))) || missions[0];
}
export function makeAttempt(mission, passed, hints, mode) {
  return {
    id: crypto.randomUUID(), missionId: mission.id, missionVersion: mission.version,
    concepts: [...mission.concepts], passed, hints, mode, at: new Date().toISOString(),
  };
}
// A transparent practice heuristic, not a calibrated estimate of mastery.
// Derive from exported evidence so imports and migrations cannot lose the schedule.
export function conceptReviews(progress, missions, now = Date.now()) {
  const byId = new Map(missions.map(m => [m.id, m]));
  const rows = new Map();
  const attempts = progress.attempts.slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const a of attempts) {
    const m = byId.get(a.missionId);
    if (!m || (a.missionVersion ?? 1) !== m.version) continue;
    for (const concept of a.concepts?.length ? a.concepts.filter(c => m.concepts.includes(c)) : m.concepts) {
      const row = rows.get(concept) || { concept, title: CONCEPTS[concept], streak: 0, independent: new Set(), lastMission: m.id };
      row.streak = a.passed && a.hints === 0 ? row.streak + 1 : 0;
      if (a.passed && a.hints === 0) row.independent.add(m.id);
      const days = row.streak ? [3, 7, 14, 30][Math.min(row.streak - 1, 3)] : 1;
      row.dueAt = Date.parse(a.at) + days * 86400000;
      row.lastMission = m.id;
      row.lastResult = !a.passed ? "Needs another attempt" : a.hints ? "Practiced with help" : "Independent practice";
      rows.set(concept, row);
    }
  }
  return [...rows.values()].map(row => {
    const variants = missions.filter(m => m.concepts.includes(row.concept) && m.transferOf && row.independent.has(m.transferOf));
    const next = variants.find(m => !row.independent.has(m.id)) || byId.get(row.lastMission);
    return { ...row, independent: [...row.independent], mission: next, due: row.dueAt <= now,
      transferred: variants.some(m => row.independent.has(m.id)),
      evidence: variants.some(m => row.independent.has(m.id)) ? "Applied to a new variant" : row.independent.size ? "Independent practice; transfer unverified" : "Building understanding" };
  }).sort((a, b) => a.dueAt - b.dueAt);
}
export function reviewDue(progress, now = Date.now()) {
  return [
    ...new Set(
      progress.attempts
        .filter((a) => a.passed && now - Date.parse(a.at) > 3 * 86400000)
        .map((a) => a.missionId),
    ),
  ].filter(
    (id) =>
      !progress.attempts.some(
        (a) =>
          a.missionId === id &&
          a.passed &&
          now - Date.parse(a.at) < 3 * 86400000,
      ),
  );
}
