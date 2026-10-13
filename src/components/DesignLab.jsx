import { useState } from "react";
import { Save, Activity, Server, Database } from "lucide-react";
import { defaults, simulate } from "../lib/simulator.mjs";
import ServiceMap from "./ServiceMap";
export default function DesignLab({ setProgress }) {
  const [config, setConfig] = useState(defaults),
    [rationale, setRationale] = useState(""),
    [saved, setSaved] = useState(false);
  const s = simulate(config);
  function update(k, v) {
    setConfig((c) => ({ ...c, [k]: v }));
    setSaved(false);
  }
  return (
    <>
      <div className="eyebrow">EXPERIMENT / OBSERVE / EXPLAIN</div>
      <h1>Design for the unexpected.</h1>
      <p className="lede">
        Can Relay absorb a traffic spike and lose an API replica? Change one
        thing and inspect the tradeoff.
      </p>
      <div className="design-layout">
        <section className="panel controls">
          <h2>Scenario controls</h2>
          {[
            ["traffic", "Incoming traffic", 100, 10000, 100, "req/s"],
            ["nodes", "API replicas", 1, 10, 1, ""],
            ["cache", "Cache hit rate", 0, 95, 5, "%"],
            ["db", "Database capacity", 100, 3000, 100, "req/s"],
          ].map(([key, label, min, max, step, unit]) => (
            <label className="slider" key={key}>
              <span>
                {label}
                <strong>
                  {config[key]} {unit}
                </strong>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={config[key]}
                onChange={(e) => update(key, Number(e.target.value))}
              />
            </label>
          ))}
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.failed}
              onChange={(e) => update("failed", e.target.checked)}
            />{" "}
            Inject one API replica failure
          </label>
          <button
            onClick={() => {
              setConfig({ ...defaults });
              setSaved(false);
            }}
          >
            Reset scenario
          </button>
        </section>
        <section className="panel architecture">
          <div className="section-title">
            <h2>Relay architecture</h2>
            <span className={`tag ${s.overloaded ? "amber" : "lime"}`}>
              {s.overloaded ? "OVER CAPACITY" : "WITHIN CAPACITY"}
            </span>
          </div>
          <ServiceMap failed={config.failed} />
          <div className="stats compact">
            <div>
              <Activity />
              <strong>{s.p95 === null ? "Unstable" : `${s.p95} ms`}</strong>
              <span>Illustrative p95</span>
            </div>
            <div>
              <Server />
              <strong>
                {s.active} / {s.nodes}
              </strong>
              <span>Active replicas</span>
            </div>
            <div>
              <Database />
              <strong>{s.dbTraffic}</strong>
              <span>DB requests / sec</span>
            </div>
          </div>
        </section>
      </div>
      <div className="cards design-results">
        <div className="panel">
          <h3>Capacity pressure</h3>
          <strong className="big-number">
            {Number.isFinite(s.utilization)
              ? Math.round(s.utilization * 100)
              : "∞"}
            %
          </strong>
          <p>
            {s.bottleneck} is the limiting resource.{" "}
            {s.overloaded
              ? "The model cannot drain arrivals fast enough."
              : "Capacity exceeds average arrivals in this model."}
          </p>
        </div>
        <div className="panel">
          <h3>Excess traffic</h3>
          <strong className="big-number">{s.error.toFixed(1)}%</strong>
          <p>
            Traffic above effective capacity, modeled as rejected requests. Real
            queue and timeout behavior varies.
          </p>
        </div>
        <div className="panel">
          <h3>Relative cost</h3>
          <strong className="big-number">
            {s.cost}
            <small> units</small>
          </strong>
          <p>
            Compare resource choices. These are illustrative weights, not cloud
            prices.
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>Defend your decision</h2>
        <p>
          What bottleneck did you find? How would you test your hypothesis? What
          happens when the cache goes cold?
        </p>
        <textarea
          aria-label="Design rationale"
          maxLength={10000}
          value={rationale}
          onChange={(e) => {
            setRationale(e.target.value);
            setSaved(false);
          }}
          placeholder="My design trades…"
        />
        <button
          className="primary"
          disabled={!rationale.trim()}
          onClick={() => {
            setProgress((p) => ({
              ...p,
              designs: [
                ...p.designs,
                {
                  name: "Relay capacity experiment",
                  rationale,
                  config,
                  at: new Date().toISOString(),
                },
              ].slice(-100),
            }));
            setSaved(true);
          }}
        >
          <Save size={16} />
          {saved ? "Saved to portfolio" : "Save experiment"}
        </button>
      </section>
      <details className="model-notes">
        <summary>Model assumptions and equations</summary>
        <p>
          Each API replica supplies 600 req/s. Cache hits bypass the database.
          Effective capacity is min(active replicas × 600, database capacity ÷
          cache miss fraction). Traffic at or above capacity is unstable. Below
          capacity, illustrative p95 is 30 + 1000 × −ln(0.05) ÷ (capacity −
          traffic) milliseconds.
        </p>
        <p>
          This simplified queueing model ignores traffic bursts, cache warmup,
          replication lag, tail distributions and network overhead. It is a tool
          for exploring tradeoffs, not a production performance prediction.
        </p>
      </details>
    </>
  );
}
