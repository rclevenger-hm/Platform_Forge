import { useEffect, useState } from "react";
import {
  House,
  Repeat2,
  FileCode2,
  Map,
  Terminal,
  Network,
  MessagesSquare,
  NotebookPen,
  Settings as SettingsIcon,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import missions from "./data/missions.json";
import tracks from "./data/tracks.json";
import { KEY, fresh, readProgress } from "./lib/progress.mjs";
import { request } from "./lib/api.mjs";
import Home from "./components/Home";
import Campaign from "./components/Campaign";
import Practice from "./components/Practice";
import DesignLab from "./components/DesignLab";
import Portfolio from "./components/Portfolio";
import Interview from "./components/Interview";
import Settings from "./components/Settings";
import Review from "./components/Review";
import Author from "./components/Author";
const nav = [
  ["Home", House],
  ["Campaign", Map],
  ["Practice", Terminal],
  ["Review", Repeat2],
  ["Design Lab", Network],
  ["Interview", MessagesSquare],
  ["Portfolio", NotebookPen],
  ["Author", FileCode2],
  ["Settings", SettingsIcon],
];
function route() {
  try {
    const value = decodeURIComponent(location.hash.slice(1)).split("/")[0];
    return nav.some(([n]) => n === value) ? value : "Home";
  } catch {
    return "Home";
  }
}
function routedMission() {
  try { const [page,id] = decodeURIComponent(location.hash.slice(1)).split("/"); return page === "Practice" && missions.some(m => m.id === id) ? id : "M01"; } catch { return "M01"; }
}
export default function App() {
  const [page, setPage] = useState(route),
    [missionId, setMissionId] = useState(routedMission),
    [mobile, setMobile] = useState(false),
    [progress, setProgress] = useState(() => {
      try {
        return readProgress(localStorage);
      } catch {
        return fresh();
      }
    }),
    [storageError, setStorageError] = useState(""),
    [settings, setSettings] = useState({ url: "", token: "" }),
    [capabilities, setCapabilities] = useState({
      tutor: false,
      runner: false,
      connected: false,
    });
  useEffect(() => {
    const onHash = () => { setPage(route()); if (route() === "Practice") setMissionId(routedMission()); };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Export your progress before closing this tab.",
      );
    }
  }, [progress]);
  useEffect(() => {
    const c = new AbortController();
    request({ url: "", token: "" }, "capabilities", undefined, c.signal)
      .then(setCapabilities)
      .catch(() => {});
    return () => c.abort();
  }, []);
  function navigate(name, id = missionId) {
    setPage(name);
    location.hash = encodeURIComponent(name === "Practice" ? `Practice/${id}` : name);
    setMobile(false);
    window.scrollTo({ top: 0 });
  }
  function openMission(id) {
    if (!missions.some(m => m.id === id)) return navigate("Campaign");
    setMissionId(id);
    navigate("Practice", id);
  }
  const common = {
    missions,
    tracks,
    progress,
    setProgress,
    openMission,
    navigate,
    settings,
    setSettings,
    capabilities,
    setCapabilities,
  };
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content").focus();
        }}
      >
        Skip to content
      </a>
      <button
        className="mobile-menu"
        onClick={() => setMobile((v) => !v)}
        aria-label="Toggle navigation"
      >
        {mobile ? <X /> : <Menu />}
      </button>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a className="brand" href="#Home" onClick={() => navigate("Home")}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <span>
            PLATFORM
            <br />
            <strong>FORGE</strong>
          </span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(([name, Icon]) => (
            <button
              aria-label={name}
              className={page === name ? "active" : ""}
              aria-current={page === name ? "page" : undefined}
              key={name}
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              {name}
              {name === "Campaign" && <span className="nav-count">{missions.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-status">
            <span className="dot online" /> Standalone learning ready
          </div>
          <p>
            Your next level starts
            <br />
            with one good question.
          </p>
          <a
            href="https://github.com/rclevenger-hm/Platform_Forge"
            target="_blank"
            rel="noreferrer"
          >
            Open source <ExternalLink size={13} />
          </a>
          <small>v0.2.1 · Guided practice</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <span className="separator">/</span>{" "}
            <strong>{page}</strong>
          </span>
          <button
            className="connection-pill"
            onClick={() => navigate("Settings")}
          >
            <span className={`dot ${capabilities.tutor ? "online" : ""}`} />
            {capabilities.tutor
              ? "AI mentor connected"
              : "AI optional · standalone mode"}
          </button>
        </header>
        <main id="main-content" tabIndex={-1}>
          {storageError && (
            <div className="warning" role="alert">
              {storageError}
            </div>
          )}
          {page === "Home" && <Home {...common} />}{" "}
          {page === "Campaign" && <Campaign {...common} />}{" "}
          {page === "Practice" && (
            <Practice
              key={missionId}
              mission={missions.find((m) => m.id === missionId)}
              {...common}
            />
          )}{" "}
          {page === "Design Lab" && <DesignLab {...common} />}{" "}
          {page === "Portfolio" && <Portfolio {...common} />}{" "}
          {page === "Interview" && <Interview {...common} />}{" "}
          {page === "Review" && <Review {...common} />}
          {page === "Author" && <Author {...common} />}
          {page === "Settings" && <Settings {...common} />}
        </main>
        <footer>
          Small experiments. Clear evidence. Better engineering.
          <span>Platform Forge · Built to be explored</span>
        </footer>
      </div>
    </div>
  );
}
