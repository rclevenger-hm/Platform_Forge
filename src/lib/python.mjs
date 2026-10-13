export function runPython(code, tests, { onWorker, timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL(
        "python-worker.js",
        new URL(import.meta.env.BASE_URL, location.origin),
      ),
      { type: "module" },
    );
    onWorker?.(worker);
    const timer = setTimeout(() => {
      worker.terminate();
      reject(
        Error(
          "Execution exceeded 60 seconds. Check for an infinite loop, then try again.",
        ),
      );
    }, timeout);
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
      onWorker?.(null);
    };
    worker.onmessage = (e) => {
      finish();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      finish();
      reject(
        Error(
          e.message || "Python could not start. Reload the page and try again.",
        ),
      );
    };
    worker.postMessage({
      code,
      tests,
      indexURL: new URL(
        "pyodide/",
        new URL(import.meta.env.BASE_URL, location.origin),
      ).href,
    });
  });
}
