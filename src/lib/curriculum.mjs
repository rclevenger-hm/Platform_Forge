// Content is data. Only these bounded check types are interpreted by the browser.
export const CONCEPTS = {
  evidence: 'Gather evidence before changing a system',
  permissions: 'Least-privilege file permissions',
  recovery: 'Verify service recovery',
  storage: 'Recover capacity without losing evidence',
  pipelines: 'Propagate pipeline failures',
  quoting: 'Preserve shell argument boundaries',
  aggregation: 'Aggregate operational events',
  boundaries: 'Handle empty inputs and boundaries',
  retries: 'Bound and classify retries',
  ordering: 'Make ranking deterministic',
  scheduling: 'Make scheduled jobs predictable',
  concurrency: 'Prevent overlapping work',
  delivery: 'Gate delivery on explicit evidence',
  idempotency: 'Make repeated events safe',
};
const id = /^[A-Z][A-Z0-9_-]{1,39}$/;
const text = (v, max = 30000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const strings = (v, min = 1) => Array.isArray(v) && v.length >= min && v.length <= 100 && v.every(x => text(x));
export function validateMission(m, tracks = []) {
  const errors = [];
  const require = (ok, message) => { if (!ok) errors.push(message); };
  if (!m || typeof m !== 'object' || Array.isArray(m)) return ['Mission must be an object.'];
  require(id.test(m.id || ''), 'id: use 2–40 uppercase letters, digits, underscores or hyphens.');
  require(Number.isInteger(m.version) && m.version > 0, 'version: positive integer required.');
  for (const k of ['title', 'summary', 'objective', 'why']) require(text(m[k]), `${k}: nonempty text required.`);
  require(tracks.some(t => t.id === m.track), 'track: choose a known curriculum track.');
  require(['terminal', 'config', 'python'].includes(m.kind), 'kind: terminal, config or python required.');
  require(['Foundation', 'Core', 'Advanced'].includes(m.difficulty), 'difficulty: Foundation, Core or Advanced required.');
  require(Number.isInteger(m.minutes) && m.minutes > 0 && m.minutes <= 240, 'minutes: integer from 1 to 240 required.');
  require(strings(m.lesson, 2), 'lesson: at least two explanatory paragraphs required.');
  require(strings(m.hints) && m.hints.length === 3, 'hints: exactly three progressive hints required.');
  require(strings(m.quiz) && m.quiz.length === 4, 'quiz: one question and three choices required.');
  require(Number.isInteger(m.answer) && m.answer >= 0 && m.answer < 3, 'answer: zero-based choice from 0 to 2 required.');
  require(strings(m.concepts) && new Set(m.concepts).size === m.concepts.length && m.concepts.every(c => Object.hasOwn(CONCEPTS, c)), 'concepts: unique known concept keys required.');
  require(Array.isArray(m.prerequisites) && m.prerequisites.every(x => typeof x === 'string' && id.test(x)), 'prerequisites: array of mission IDs required.');
  if (m.transferOf !== undefined) require(typeof m.transferOf === 'string' && id.test(m.transferOf), 'transferOf: mission ID required.');
  if (m.kind === 'terminal') require(strings(m.commands), 'commands: worked solution commands required.');
  else {
    require(typeof m.starter === 'string' && m.starter.length <= 24000, 'starter: code of at most 24000 characters required.');
    require(text(m.solution, 24000), 'solution: worked solution required.');
  }
  if (m.kind === 'python') require(text(m.tests), 'tests: authored Python checks required.');
  if (['terminal', 'config'].includes(m.kind)) {
    require(Array.isArray(m.checks) && m.checks.length > 0 && m.checks.length <= 20, 'checks: 1–20 browser checks required.');
    for (const c of Array.isArray(m.checks) ? m.checks : []) {
      if (!c || typeof c !== 'object') { errors.push('check: object required.'); continue; }
      require(text(c.label, 200), 'check.label: short explanation required.');
      if (m.kind === 'terminal') {
        require(['read', 'state', 'filePresent'].includes(c.type), 'check.type: read, state or filePresent required.');
        if (c.type === 'state') {
          require(['mode', 'running', 'cleared', 'inspectedDisk'].includes(c.key), 'check.key: supported terminal state required.');
          require(c.key === 'mode' ? /^[0-7]{3}$/.test(c.value) : typeof c.value === 'boolean', 'check.value: valid terminal state required.');
        } else require(text(c.value, 200), 'check.value: file path required.');
      } else {
        require(['line', 'oneOfLines', 'lineCount', 'normalizedLine'].includes(c.type), 'check.type: supported configuration check required.');
        if (c.type === 'lineCount') require(Number.isInteger(c.value) && c.value > 0 && c.value < 100, 'check.value: positive line count required.');
        else if (c.type === 'oneOfLines') require(strings(c.value), 'check.value: allowed lines required.');
        else require(text(c.value), 'check.value: expected line required.');
      }
    }
  }
  if (m.runtime !== undefined) {
    require(m.kind === 'config' && m.runtime === 'bash', 'runtime: bash is supported for config missions.');
    require(Array.isArray(m.cases) && m.cases.length > 0 && m.cases.length <= 12, 'cases: 1–12 Bash cases required.');
    for (const c of Array.isArray(m.cases) ? m.cases : []) {
      if (!c || typeof c !== 'object') { errors.push('case: object required.'); continue; }
      require(text(c.label, 200), 'case.label required.');
      require(Array.isArray(c.args) && c.args.length <= 30 && c.args.every(a => typeof a === 'string' && a.length <= 1000), 'case.args: bounded string array required.');
      require(typeof c.stdin === 'string' && c.stdin.length <= 10000, 'case.stdin: text required.');
      require(typeof c.stdout === 'string' && c.stdout.length <= 10000, 'case.stdout: exact expected text required.');
      require(Number.isInteger(c.exit) && c.exit >= 0 && c.exit <= 255, 'case.exit: expected exit status required.');
    }
  }
  return errors;
}
export function validateCurriculum(missions, tracks) {
  if (!Array.isArray(missions) || !missions.length) return ['Curriculum must contain missions.'];
  const errors = missions.flatMap((m, i) => validateMission(m, tracks).map(e => `${m?.id || i}: ${e}`));
  const byId = new Map(missions.map(m => [m?.id, m]));
  if (byId.size !== missions.length) errors.push('Mission IDs must be unique.');
  for (const m of missions) {
    if (!m || !Array.isArray(m.prerequisites)) continue;
    for (const ref of [...m.prerequisites, ...(m.transferOf ? [m.transferOf] : [])]) {
      if (!byId.has(ref) || ref === m.id) errors.push(`${m.id}: invalid mission reference ${ref}.`);
    }
    const base = byId.get(m.transferOf);
    if (base && !(Array.isArray(m.concepts) && m.concepts.some(c => Array.isArray(base.concepts) && base.concepts.includes(c)))) errors.push(`${m.id}: transfer must share a concept with its source.`);
  }
  const visiting = new Set(), visited = new Set();
  function visit(m) {
    if (!m || visited.has(m.id)) return;
    if (visiting.has(m.id)) { errors.push(`${m.id}: prerequisite cycle.`); return; }
    visiting.add(m.id);
    for (const ref of Array.isArray(m.prerequisites) ? m.prerequisites : []) visit(byId.get(ref));
    visiting.delete(m.id); visited.add(m.id);
  }
  missions.forEach(visit);
  return errors;
}
