// Only the latest connection check may update the selected backend.
export function createConnectionCheck() {
  let active = null;
  function cancel() {
    active?.abort();
    active = null;
  }
  return {
    cancel,
    start() {
      cancel();
      const controller = new AbortController();
      active = controller;
      return {
        signal: controller.signal,
        current: () => active === controller && !controller.signal.aborted,
        finish: () => { if (active === controller) active = null; },
      };
    },
  };
}
