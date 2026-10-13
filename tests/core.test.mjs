import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fresh,
  validateProgress,
  status,
  reviewDue,
  readProgress,
} from "../src/lib/progress.mjs";
import { simulate, defaults } from "../src/lib/simulator.mjs";
import {
  command,
  initialTerminal,
  terminalChecks,
  configChecks,
} from "../src/lib/terminal.mjs";
const missions = JSON.parse(
  readFileSync(new URL("../src/data/missions.json", import.meta.url)),
);
test("every mission has authored learning, explanation and three hints", () => {
  assert.equal(missions.length, 20);
  assert.equal(new Set(missions.map((m) => m.id)).size, 20);
  for (const m of missions) {
    assert.equal(m.hints.length, 3);
    assert.equal(m.quiz.length, 4);
    assert.ok(m.answer >= 0 && m.answer <= 2);
    assert.ok(m.lesson.length >= 2);
    assert.ok(m.objective);
    if (m.kind === "python") {
      assert.ok(m.tests.includes("assert"));
      assert.ok(m.solution);
    }
  }
});
test("template checks reject starter configurations and accept authored solutions", () => {
  for (const m of missions.filter((m) => m.kind === "config")) {
    assert.ok(
      configChecks(m, m.starter).some((x) => !x[1]),
      m.id,
    );
    assert.ok(
      configChecks(m, m.solution).every((x) => x[1]),
      m.id,
    );
  }
});
test("terminal goals require observable state changes", () => {
  for (const m of missions.filter((m) => m.kind === "terminal")) {
    let state = initialTerminal();
    assert.ok(terminalChecks(m, state).some((x) => !x[1]));
    for (const input of m.commands) state = command(state, input).state;
    assert.ok(
      terminalChecks(m, state).every((x) => x[1]),
      m.id,
    );
  }
});
test("simulated shell cannot delete protected audit evidence or execute arbitrary commands", () => {
  let s = initialTerminal();
  s = command(s, "rm -rf /").state;
  s = command(s, "truncate -s 0 /var/log/audit.log").state;
  assert.ok(s.files["/var/log/audit.log"]);
  assert.match(command(s, "curl bad.example").output, /not supported/);
});
test("progress import rejects invalid results and prototype keys", () => {
  assert.throws(() => validateProgress({ version: 4, attempts: [] }));
  assert.throws(() =>
    validateProgress({ version: 1, attempts: [{ passed: "true" }] }),
  );
  const p = validateProgress(
    JSON.parse(
      '{"version":1,"attempts":[],"notes":{"__proto__":"bad","M01":"good"}}',
    ),
  );
  assert.equal(p.notes.M01, "good");
  assert.equal(Object.hasOwn(p.notes, "__proto__"), false);
  assert.deepEqual(
    readProgress({
      getItem() {
        throw Error("blocked");
      },
    }),
    fresh(),
  );
});
test("assisted completion, independent passes and review dates remain distinct", () => {
  const p = fresh();
  p.attempts.push({
    id: "1",
    missionId: "M01",
    passed: true,
    hints: 1,
    mode: "browser simulation",
    at: "2026-01-01T00:00:00Z",
  });
  assert.equal(status(p, "M01"), "Completed with help");
  assert.deepEqual(reviewDue(p, Date.parse("2026-01-05T00:00:00Z")), ["M01"]);
  p.attempts.push({
    ...p.attempts[0],
    id: "2",
    hints: 0,
    at: "2026-01-04T00:00:00Z",
  });
  assert.equal(status(p, "M01"), "Independent pass");
  assert.deepEqual(reviewDue(p, Date.parse("2026-01-05T00:00:00Z")), []);
});
test("capacity model reacts to a failed sole replica and database bottleneck", () => {
  assert.equal(simulate(defaults).overloaded, false);
  const down = simulate({ ...defaults, nodes: 1, failed: true });
  assert.equal(down.active, 0);
  assert.equal(down.error, 100);
  assert.equal(down.p95, null);
  const db = simulate({ ...defaults, cache: 0, db: 100 });
  assert.equal(db.bottleneck, "Database capacity");
  assert.ok(db.overloaded);
  assert.ok(simulate({ ...defaults, traffic: -99 }).traffic >= 100);
});
