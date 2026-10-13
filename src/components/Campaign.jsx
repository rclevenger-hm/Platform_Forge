import { useState } from "react";
import { ArrowRight, Search, CheckCircle2, LockKeyhole } from "lucide-react";
import { status } from "../lib/progress.mjs";
export default function Campaign({ missions, tracks, progress, openMission }) {
  const [track, setTrack] = useState("all"),
    [query, setQuery] = useState("");
  const visible = missions.filter(
    (m) =>
      (track === "all" || m.track === track) &&
      `${m.title} ${m.summary}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="eyebrow">LEARN BY DOING</div>
      <h1>The Relay campaign</h1>
      <p className="lede">
        Fifteen original missions. Read, investigate, fix, explain, then
        revisit.
      </p>
      <div className="filter-bar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search missions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search missions…"
          />
        </label>
        <select
          aria-label="Curriculum track"
          value={track}
          onChange={(e) => setTrack(e.target.value)}
        >
          <option value="all">All tracks</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div className="mission-list">
        {visible.map((m) => (
          <button
            className="panel mission-row"
            key={m.id}
            onClick={() => openMission(m.id)}
          >
            <span className="mission-number">
              {status(progress, m.id) !== "Not started" ? (
                <CheckCircle2 />
              ) : (
                m.id
              )}
            </span>
            <div>
              <h3>{m.title}</h3>
              <p>{m.summary}</p>
              <span className="tag">
                {m.kind === "python"
                  ? "Python execution"
                  : "Browser simulation"}
              </span>{" "}
              <span className="muted">
                {m.minutes} min · {status(progress, m.id)}
              </span>
            </div>
            <ArrowRight size={19} />
          </button>
        ))}
      </div>
      {!visible.length && (
        <div className="panel empty">
          <LockKeyhole />
          <h2>
            {query ? "No matching missions" : "This track is on the roadmap"}
          </h2>
          <p>
            {tracks.find((t) => t.id === track)?.description ||
              "Try a different search."}
          </p>
          <p>
            New tracks will ship with authored lessons, runnable practice, and
            review criteria.
          </p>
        </div>
      )}
      <p className="footnote">
        Progress records practice evidence, not a hiring credential. Platform,
        Kubernetes, networking, and advanced distributed systems tracks are
        planned.
      </p>
    </>
  );
}
