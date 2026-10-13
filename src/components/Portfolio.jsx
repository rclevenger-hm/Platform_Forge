import { useRef, useState } from "react";
import { Download, Upload, FileCheck2 } from "lucide-react";
import { JOURNAL_FIELDS, journalMarkdown } from "../lib/journal.mjs";
import { validateProgress, status } from "../lib/progress.mjs";
export default function Portfolio({
  progress,
  setProgress,
  missions,
  openMission,
  navigate,
}) {
  const file = useRef(),
    [message, setMessage] = useState("");
  function download() {
    const blob = new Blob([JSON.stringify(progress, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `platform-forge-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadJournal() {
    const url = URL.createObjectURL(new Blob([journalMarkdown(missions, progress)], {type:"text/markdown"}));
    const a = document.createElement("a"); a.href = url; a.download = "platform-forge-journal.md"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function restore(e) {
    try {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 3e6)
        throw Error("Choose a progress file smaller than 3 MB.");
      const clean = validateProgress(JSON.parse(await f.text()));
      if (
        window.confirm(
          "Replace progress in this browser with the imported file? Export first if you need a backup.",
        )
      ) {
        setProgress(clean);
        setMessage("Progress restored.");
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      e.target.value = "";
    }
  }
  return (
    <>
      <div className="eyebrow">YOUR EVIDENCE, YOUR STORY</div>
      <h1>The engineering notebook.</h1>
      <p className="lede">
        Keep the reasoning behind the fixes. Export a portable record of your
        practice.
      </p>
      <div className="toolbar">
        <button className="primary" onClick={download}>
          <Download size={16} /> Export progress
        </button>
        <button onClick={() => file.current.click()}>
          <Upload size={16} /> Import backup
        </button>
        <button onClick={downloadJournal}><Download size={16}/> Export incident journal</button>
        <input
          hidden
          ref={file}
          type="file"
          accept=".json,application/json"
          onChange={restore}
        />
      </div>
      {message && <p role="status">{message}</p>}
      <div className="cards">
        {missions
          .filter(
            (m) =>
              status(progress, m) !== "Not started" || progress.notes[m.id] || progress.incidents?.[m.id],
          )
          .map((m) => (
            <article className="panel" key={m.id}>
              <FileCheck2 className="accent" />
              <span className="eyebrow">
                {m.id} · {status(progress, m)}
              </span>
              <h3>{m.title}</h3>
              <p className="preserve">
                {progress.notes[m.id] ||
                  "Add a handoff note to explain your approach."}
              </p>
              {progress.incidents?.[m.id] && <details><summary>Incident reasoning · v{progress.incidents[m.id].version}</summary>{JOURNAL_FIELDS.map(key => progress.incidents[m.id][key] && <div key={key}><strong>{key[0].toUpperCase()+key.slice(1)}</strong><p className="preserve">{progress.incidents[m.id][key]}</p></div>)}</details>}
              <button onClick={() => openMission(m.id)}>Revisit mission</button>
            </article>
          ))}
      </div>
      {!progress.attempts.length && !Object.keys(progress.notes).length && !Object.keys(progress.incidents || {}).length && (
        <div className="panel empty">
          <FileCheck2 />
          <h2>Your first fix belongs here.</h2>
          <p>
            Complete a mission or write a handoff note to start your portfolio.
          </p>
          <button onClick={() => openMission("M01")}>Start the campaign</button>
        </div>
      )}
      <h2>Design experiments</h2>
      {progress.designs.length ? (
        progress.designs
          .slice()
          .reverse()
          .map((d, i) => (
            <article className="panel journal" key={`${d.at}-${i}`}>
              <span className="eyebrow">
                {new Date(d.at).toLocaleDateString()}
              </span>
              <h3>{d.name}</h3>
              <p className="preserve">{d.rationale}</p>
              <small>
                {d.config.nodes} replicas · {d.config.traffic} req/s ·{" "}
                {d.config.cache}% cache hits
              </small>
              {d.graph && <button onClick={() => {
                setProgress(p => ({...p,designDraft:{name:d.name, rationale:d.rationale, config:d.config, graph:d.graph, baseline:d.baseline || null}}));
                navigate("Design Lab");
              }}>Reopen design</button>}
            </article>
          ))
      ) : (
        <p className="muted">Saved Design Lab experiments will appear here.</p>
      )}
      <h2>Recent attempts</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mission</th>
              <th>Result</th>
              <th>Help</th>
              <th>Environment</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {progress.attempts
              .slice(-30)
              .reverse()
              .map((a, i) => (
                <tr key={`${a.id}-${i}`}>
                  <td>{a.missionId} · v{a.missionVersion ?? 1}</td>
                  <td>{a.passed ? "Passed" : "Revisit"}</td>
                  <td>{a.hints ? "Used" : "None recorded"}</td>
                  <td>{a.mode}</td>
                  <td>{new Date(a.at).toLocaleDateString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        Records are self-reported practice evidence stored on this device.
        Browser checks are visible and editable; this is not a proctored
        assessment.
      </p>
    </>
  );
}
