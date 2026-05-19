import { useEffect, useState } from "react";
import { Clock, Play, Pause, RotateCcw } from "lucide-react";
const prompts = [
  {
    id: "incident",
    title: "The queue is growing",
    prompt:
      "Relay processes customer notifications. Queue age has risen from 2 seconds to 8 minutes after a deployment, but CPU is only 30%. Walk through your first ten minutes.",
    rubric: [
      "Clarify customer impact and scope.",
      "Compare arrival and service rates, errors, and dependency latency.",
      "Form falsifiable hypotheses and choose safe observations.",
      "Explain rollback or mitigation criteria.",
      "Close with verification, communication, and follow-up.",
    ],
  },
  {
    id: "design",
    title: "Design a job platform",
    prompt:
      "Design an internal platform that schedules millions of background jobs a day. Teams need retries, isolation, deployment visibility, and a simple onboarding path.",
    rubric: [
      "Ask about workloads, latency targets and failure tolerance.",
      "Explain queues, scheduling, state and ownership.",
      "Discuss idempotency, retries, fairness and backpressure.",
      "Cover isolation, secrets, observability and rollout.",
      "Identify tradeoffs and how to validate the design.",
    ],
  },
  {
    id: "leadership",
    title: "A safer paved road",
    prompt:
      "Developers keep bypassing the approved deployment pipeline because it is slow. Security wants stronger controls. How would you improve adoption without adding friction?",
    rubric: [
      "Understand developer and security needs using evidence.",
      "Define a measurable service objective for the platform.",
      "Propose a small reversible improvement.",
      "Explain collaboration, rollout and feedback.",
      "Evaluate adoption and delivery outcomes, not vanity counts.",
    ],
  },
];
export default function Interview({ progress, setProgress, capabilities }) {
  const [id, setId] = useState("incident"),
    [seconds, setSeconds] = useState(0),
    [running, setRunning] = useState(false),
    [show, setShow] = useState(false);
  const p = prompts.find((p) => p.id === id);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return (
    <>
      <div className="eyebrow">PRACTICE YOUR REASONING</div>
      <h1>Make your thinking visible.</h1>
      <p className="lede">
        Open-ended interview practice with authored review criteria. No keyword
        score pretending to measure engineering judgment.
      </p>
      <div className="filter-bar">
        <select
          aria-label="Interview prompt"
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setSeconds(0);
            setRunning(false);
            setShow(false);
          }}
        >
          {prompts.map((p) => (
            <option value={p.id} key={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <div className="timer">
          <Clock size={18} />
          <span>
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:
            {String(seconds % 60).padStart(2, "0")}
          </span>
          <button
            aria-label={running ? "Pause timer" : "Start timer"}
            onClick={() => setRunning((r) => !r)}
          >
            {running ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            aria-label="Reset timer"
            onClick={() => {
              setRunning(false);
              setSeconds(0);
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <section className="panel">
        <h2>{p.title}</h2>
        <p className="interview-prompt">{p.prompt}</p>
        <textarea
          className="interview-answer"
          aria-label="Interview response"
          placeholder="Clarifying questions → hypotheses → tradeoffs → verification…"
          maxLength={10000}
          value={progress.notes[`interview-${id}`] || ""}
          onChange={(e) =>
            setProgress((v) => ({
              ...v,
              notes: { ...v.notes, [`interview-${id}`]: e.target.value },
            }))
          }
        />
        <small>Autosaved and included in your progress export.</small>
        <button className="primary" onClick={() => setShow((s) => !s)}>
          {show ? "Hide review criteria" : "Review my reasoning"}
        </button>
        {show && (
          <div className="rubric">
            <h3>Self-review checklist</h3>
            {p.rubric.map((r) => (
              <label key={r}>
                <input type="checkbox" /> {r}
              </label>
            ))}
            <p>
              Find one missing assumption, then revise your answer. This
              checklist does not assign a pass or hiring score.
            </p>
          </div>
        )}
      </section>
      <p className="footnote">
        Contextual AI coaching is available inside campaign missions when a
        tutor endpoint is connected. These interview exercises work entirely
        offline after loading.
      </p>
    </>
  );
}
