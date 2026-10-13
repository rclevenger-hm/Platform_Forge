let runtime;
self.onmessage = async ({ data }) => {
  try {
    if (!runtime) {
      const { loadPyodide } = await import(`${data.indexURL}pyodide.mjs`);
      runtime = await loadPyodide({ indexURL: data.indexURL });
    }
    let output = "";
    runtime.setStdout({
      batched: (s) => {
        if (output.length < 12000) output += s + "\n";
      },
    });
    runtime.setStderr({
      batched: (s) => {
        if (output.length < 12000) output += s + "\n";
      },
    });
    const globals = runtime.toPy({});
    try {
      await runtime.runPythonAsync(data.code, { globals });
      await runtime.runPythonAsync(data.tests, { globals });
      self.postMessage({
        passed: true,
        output: output || "All practice checks passed.",
      });
    } finally {
      globals.destroy();
    }
  } catch (e) {
    self.postMessage({
      passed: false,
      output: String(e.message).slice(-12000),
    });
  }
};
