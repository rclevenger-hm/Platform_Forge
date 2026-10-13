import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadPyodide } from "pyodide";
import { fileURLToPath } from "node:url";
test("the bundled Python runtime executes all authored solutions", async () => {
  const runtime = await loadPyodide({
    indexURL: fileURLToPath(new URL("../public/pyodide/", import.meta.url)),
  });
  const missions = JSON.parse(
    readFileSync(new URL("../src/data/missions.json", import.meta.url)),
  );
  for (const m of missions.filter((m) => m.kind === "python")) {
    const globals = runtime.toPy({});
    try {
      await runtime.runPythonAsync(m.solution, { globals });
      await runtime.runPythonAsync(m.tests, { globals });
      assert.ok(true, m.id);
    } finally {
      globals.destroy();
    }
  }
});
