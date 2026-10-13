export const defaults = {
  traffic: 1200,
  nodes: 3,
  cache: 60,
  db: 800,
  failed: false,
};
export function simulate(input) {
  const bounded = (x, a, b, f) =>
    Number.isFinite(Number(x)) ? Math.min(b, Math.max(a, Number(x))) : f;
  const traffic = bounded(input.traffic, 100, 10000, 1200),
    nodes = Math.round(bounded(input.nodes, 1, 10, 3));
  const cache = bounded(input.cache, 0, 95, 60),
    db = bounded(input.db, 100, 3000, 800);
  const active = Math.max(0, nodes - (input.failed ? 1 : 0)),
    apiCapacity = active * 600,
    dbTraffic = traffic * (1 - cache / 100);
  const capacity = Math.min(apiCapacity, db / (1 - cache / 100));
  const utilization = capacity ? traffic / capacity : Infinity;
  const overloaded = utilization >= 1;
  const error = capacity
    ? Math.max(0, (traffic - capacity) / traffic) * 100
    : 100;
  const p95 = overloaded
    ? null
    : Math.round(30 + (-Math.log(0.05) / (capacity - traffic)) * 1000);
  return {
    traffic,
    nodes,
    active,
    cache,
    db,
    dbTraffic: Math.round(dbTraffic),
    capacity: Math.round(capacity),
    utilization,
    overloaded,
    error,
    p95,
    cost: nodes * 30 + Math.round(db / 20) + (cache ? 20 : 0),
    bottleneck:
      apiCapacity < db / (1 - cache / 100)
        ? "API capacity"
        : "Database capacity",
  };
}
