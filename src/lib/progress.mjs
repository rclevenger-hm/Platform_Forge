export const KEY = "platform-forge:v1";
export const fresh = () => ({
  version: 1,
  attempts: [],
  notes: {},
  drafts: {},
  designs: [],
});
export function validateProgress(v) {
  if (
    !v ||
    v.version !== 1 ||
    !Array.isArray(v.attempts) ||
    v.attempts.length > 10000
  )
    throw Error("Not a supported Platform Forge progress file.");
  const clean = fresh();
  clean.attempts = v.attempts.map((a) => {
    if (
      !a ||
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
        }))
    : [];
  return clean;
}
function safeConfig(c = {}) {
  return Object.fromEntries(
    Object.entries(c).filter(
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
export function status(progress, id) {
  const a = progress.attempts.filter((x) => x.missionId === id && x.passed);
  return a.length
    ? a.some((x) => x.hints === 0)
      ? "Independent pass"
      : "Completed with help"
    : "Not started";
}
export function nextMission(missions, progress) {
  return (
    missions.find(
      (m) => !progress.attempts.some((a) => a.missionId === m.id && a.passed),
    ) || missions[0]
  );
}
export function makeAttempt(id, passed, hints, mode) {
  return {
    id: crypto.randomUUID(),
    missionId: id,
    passed,
    hints,
    mode,
    at: new Date().toISOString(),
  };
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
