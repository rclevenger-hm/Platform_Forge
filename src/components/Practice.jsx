import { useEffect, useRef, useState } from "react";
import {
  Play,
  RotateCcw,
  Lightbulb,
  CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import {
  initialTerminal,
  command,
  terminalChecks,
  configChecks,
} from "../lib/terminal.mjs";
import { makeAttempt } from "../lib/progress.mjs";
import { runPython } from "../lib/python.mjs";
import { request } from "../lib/api.mjs";
import Tutor from "./Tutor";
export default function Practice({
  mission: m,
  progress,
  setProgress,
  settings,
  capabilities,
  navigate,
}) {
  const [code, setCode] = useState(progress.drafts[m.id] ?? m.starter ?? ""),
    [state, setState] = useState(initialTerminal),
    [input, setInput] = useState(""),
    [log, setLog] = useState([
      "Relay practice environment ready. Type help to explore.",
    ]),
    [checks, setChecks] = useState([]),
    [quiz, setQuiz] = useState(-1),
    [hints, setHints] = useState(0),
    [solution, setSolution] = useState(false),
    [output, setOutput] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    [engine, setEngine] = useState("browser");
  const worker = useRef(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      worker.current?.terminate();
    };
  }, []);
  function edit(value) {
    setCode(value);
    setResult(null);
    setProgress((p) => ({ ...p, drafts: { ...p.drafts, [m.id]: value } }));
  }
  function send(e) {
    e.preventDefault();
    const r = command(state, input);
    setState(r.state);
    setLog((l) =>
      r.output === "__CLEAR__"
        ? []
        : [...l, `$ ${input}`, r.output].slice(-160),
    );
    setInput("");
    setResult(null);
  }
  async function check() {
    setBusy(true);
    setResult(null);
    let list = [],
      out = "",
      mode = m.kind === "python" ? "browser Python" : "browser simulation";
    try {
      if (m.kind === "terminal") list = terminalChecks(m, state);
      else if (m.kind === "config") list = configChecks(m, code);
      else {
        const r =
          engine === "docker" && capabilities.runner
            ? await request(settings, "run", { missionId: m.id, code })
            : await runPython(code, m.tests, {
                onWorker: (w) => {
                  worker.current = w;
                },
              });
        mode =
          engine === "docker" && capabilities.runner
            ? "Docker lab"
            : "browser Python";
        list = [["Python practice checks", r.passed]];
        out = r.output;
      }
      if (!mounted.current) return;
      list.push(["Explain the concept", quiz === m.answer]);
      const passed = list.every((x) => x[1]);
      setChecks(list);
      setOutput(out);
      setResult(passed);
      setProgress((p) => ({
        ...p,
        attempts: [...p.attempts, makeAttempt(m.id, passed, hints, mode)].slice(
          -10000,
        ),
      }));
    } catch (e) {
      if (mounted.current) {
        setOutput(e.message);
        setResult(false);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <button className="text-button" onClick={() => navigate("Campaign")}>
        <ChevronLeft size={16} /> Back to campaign
      </button>
      <div className="lab-heading">
        <div>
          <div className="eyebrow">
            {m.id} · {m.track.toUpperCase()} · {m.minutes} MIN
          </div>
          <h1>{m.title}</h1>
        </div>
        <span className="tag lime">
          {m.kind === "python" ? "Runnable Python" : "Browser simulation"}
        </span>
      </div>
      <p className="lede">{m.summary}</p>
      <div className="lab-layout">
        <div className="lesson-column">
          <section className="panel lesson">
            <span className="eyebrow">01 / UNDERSTAND</span>
            <h2>Your briefing</h2>
            {m.lesson.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <div className="objective">
              <strong>Your mission</strong>
              <p>{m.objective}</p>
            </div>
            <button
              onClick={() => setHints((h) => Math.min(3, h + 1))}
              disabled={hints >= 3}
            >
              <Lightbulb size={16} /> Reveal a hint ({Math.min(hints, 3)}/3)
            </button>
            {m.hints.slice(0, hints).map((h, i) => (
              <p className="hint" key={h}>
                <strong>{i + 1}.</strong> {h}
              </p>
            ))}
            <details
              onToggle={(e) => {
                if (e.currentTarget.open) {
                  setSolution(true);
                  setHints((h) => Math.max(4, h));
                }
              }}
            >
              <summary>Study a worked solution</summary>
              {solution && <pre>{m.solution || m.commands?.join("\n")}</pre>}
              <p>
                Read it, close it, and explain why each step matters. This
                attempt will be marked as helped.
              </p>
            </details>
          </section>
          <Tutor
            mission={m}
            code={m.kind === "terminal" ? log.join("\n") : code}
            output={output}
            settings={settings}
            capabilities={capabilities}
            onHelp={() => setHints((h) => Math.min(10, h + 1))}
          />
        </div>
        <div className="workspace-column">
          <section className="panel workspace">
            <div className="workspace-bar">
              <span>
                {m.kind === "terminal" ? "relay-sim" : m.path || "solution.py"}
              </span>
              {m.kind === "python" && capabilities.runner && (
                <select
                  aria-label="Execution engine"
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                >
                  <option value="browser">Browser Python</option>
                  <option value="docker">Docker Python</option>
                </select>
              )}
              <button
                title="Reset workspace"
                aria-label="Reset workspace"
                onClick={() => {
                  edit(m.starter || "");
                  setState(initialTerminal());
                  setLog(["Environment reset. Type help."]);
                  setChecks([]);
                  setOutput("");
                  setResult(null);
                }}
                disabled={busy}
              >
                <RotateCcw size={15} />
              </button>
            </div>
            {m.kind === "terminal" ? (
              <div className="terminal">
                <pre aria-live="polite">{log.join("\n")}</pre>
                <form onSubmit={send}>
                  <label htmlFor="command">$</label>
                  <input
                    id="command"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="Type a command…"
                  />
                </form>
              </div>
            ) : (
              <textarea
                className="code-editor"
                aria-label="Code editor"
                spellCheck="false"
                value={code}
                onChange={(e) => edit(e.target.value)}
                maxLength={24000}
              />
            )}
            <div className="workspace-footer">
              {m.kind === "python"
                ? "Python runs in a disposable browser worker, or an isolated Docker container when connected."
                : "A bounded teaching model. Commands and configuration checks do not execute on the host."}
            </div>
          </section>
          <section className="panel quiz">
            <span className="eyebrow">02 / EXPLAIN</span>
            <h3>{m.quiz[0]}</h3>
            {m.quiz.slice(1).map((answer, i) => (
              <label
                className={`answer ${quiz === i ? "selected" : ""}`}
                key={answer}
              >
                <input
                  type="radio"
                  name="concept"
                  checked={quiz === i}
                  onChange={() => {
                    setQuiz(i);
                    setResult(null);
                  }}
                />
                {answer}
              </label>
            ))}
            <button
              className="primary run"
              onClick={check}
              disabled={busy || quiz === -1}
            >
              <Play size={16} />
              {busy ? "Running checks…" : "Run checks & submit"}
            </button>
            {busy && m.kind === "python" && (
              <p className="muted" role="status">
                The first Python run loads the bundled runtime. Runs stop after
                60 seconds.
              </p>
            )}
            {result !== null && (
              <div
                className={`result ${result ? "success" : "retry"}`}
                role="status"
              >
                <strong>
                  {result
                    ? "Mission complete. Nice work."
                    : "Keep investigating."}
                </strong>
                {checks.map(([label, ok]) => (
                  <p key={label}>
                    {ok ? "✓" : "○"} {label}
                  </p>
                ))}
                {quiz === m.answer && <p>{m.why}</p>}
              </div>
            )}
            {output && (
              <pre className="output" aria-label="Execution output">
                {output}
              </pre>
            )}
          </section>
          <section className="panel">
            <h3>
              <CheckCircle2 size={18} /> Leave a handoff
            </h3>
            <textarea
              aria-label="Mission notes"
              value={progress.notes[m.id] || ""}
              maxLength={10000}
              onChange={(e) =>
                setProgress((p) => ({
                  ...p,
                  notes: { ...p.notes, [m.id]: e.target.value },
                }))
              }
              placeholder="What happened? What did you change? How did you verify it?"
            />
            <small>
              Saved in this browser. Export your portfolio to keep a backup.
            </small>
          </section>
        </div>
      </div>
    </>
  );
}
