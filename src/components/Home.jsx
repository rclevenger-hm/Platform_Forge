import {
  ArrowRight,
  Terminal,
  GitBranch,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { nextMission, reviewDue, status } from "../lib/progress.mjs";
import ServiceMap from "./ServiceMap";
export default function Home({
  missions,
  tracks,
  progress,
  openMission,
  navigate,
}) {
  const next = nextMission(missions, progress),
    completed = missions.filter(
      (m) => status(progress, m.id) !== "Not started",
    ).length,
    due = reviewDue(progress);
  return (
    <>
      <div className="eyebrow">YOUR ENGINEERING JOURNEY</div>
      <h1>
        Build confidence.
        <br />
        <span>Break things. Learn why.</span>
      </h1>
      <p className="lede">
        A hands-on path from your first shell command to resilient platforms.
      </p>
      <section className="hero panel">
        <div>
          <span className="tag lime">CAMPAIGN 01 · RELAY</span>
          <h2>
            A service worth
            <br />
            keeping alive.
          </h2>
          <p>
            Join the team behind Relay. Follow the evidence, repair the system,
            and leave it better than you found it.
          </p>
          <button className="primary" onClick={() => openMission(next.id)}>
            Continue your journey <ArrowRight size={17} />
          </button>
          <small>
            {next.id} · {next.title} · {next.minutes} min
          </small>
        </div>
        <ServiceMap />
      </section>
      <div className="stats">
        <div className="panel stat">
          <CheckCircle2 />
          <strong>
            {completed}
            <em> / {missions.length}</em>
          </strong>
          <span>Missions completed</span>
        </div>
        <div className="panel stat">
          <Terminal />
          <strong>{progress.attempts.length}</strong>
          <span>Practice attempts</span>
        </div>
        <div className="panel stat">
          <BookOpen />
          <strong>{due.length}</strong>
          <span>Ready for a revisit</span>
        </div>
      </div>
      <div className="section-title">
        <h2>Your next moves</h2>
        <button className="text-button" onClick={() => navigate("Campaign")}>
          View campaign <ArrowRight size={15} />
        </button>
      </div>
      <div className="cards">
        {[
          next,
          ...missions.filter((m) => due.includes(m.id) && m.id !== next.id),
          ...missions.filter((m) => m.id !== next.id),
        ]
          .filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i)
          .slice(0, 3)
          .map((m, i) => (
            <button
              className="panel mission-card"
              key={m.id}
              onClick={() => openMission(m.id)}
            >
              <span className="card-icon">
                {i === 0 ? <Terminal /> : <GitBranch />}
              </span>
              <div className="eyebrow">
                {i === 0
                  ? "CONTINUE LEARNING"
                  : due.includes(m.id)
                    ? "REVISIT"
                    : "EXPLORE"}{" "}
                · {m.minutes} MIN
              </div>
              <h3>{m.title}</h3>
              <p>{m.summary}</p>
              <span className="card-link">
                Open mission <ArrowRight size={16} />
              </span>
            </button>
          ))}
      </div>
      <div className="section-title">
        <h2>One foundation. Many directions.</h2>
        <span className="muted">14 curriculum tracks</span>
      </div>
      <div className="track-strip">
        {tracks.slice(0, 7).map((t) => (
          <button key={t.id} onClick={() => navigate("Campaign")}>
            <span>{t.title}</span>
            <small>
              {missions.filter((m) => m.track === t.id).length || "Planned"}
              {missions.some((m) => m.track === t.id) ? " missions" : ""}
            </small>
          </button>
        ))}
      </div>
    </>
  );
}
