import { useEffect, useRef, useState } from "react";
import { Plug, Zap, ShieldCheck } from "lucide-react";
import { normalizeUrl, request } from "../lib/api.mjs";
import { createConnectionCheck } from "../lib/connection.mjs";
export default function Settings({
  account,
  settings,
  setSettings,
  capabilities,
  setCapabilities,
}) {
  const [url, setUrl] = useState(settings.url),
    [token, setToken] = useState(settings.token),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const check = useRef(null);
  if (!check.current) check.current = createConnectionCheck();
  useEffect(() => () => check.current.cancel(), []);
  async function connect(e) {
    e.preventDefault();
    const operation = check.current.start();
    setBusy(true);
    setMessage("");
    try {
      const next = { ...settings, url: normalizeUrl(url), token };
      const auth = await request(next, "auth/status", undefined, operation.signal).catch(() => null);
      if (!operation.current()) return;
      let result;
      try { result = await request(next, "capabilities", undefined, operation.signal); }
      catch (error) {
        if (!auth?.available) throw error;
        result = {connected:true,tutor:false,runner:false};
      }
      if (!operation.current()) return;
      account.refreshAvailability(auth || {available:false});
      setSettings(next);
      setCapabilities(result);
      setMessage("Backend connected. Sign in from Account to save your progress.");
    } catch (e) {
      if (!operation.current()) return;
      setCapabilities({ tutor: false, runner: false, connected: false });
      setMessage(e.message);
    } finally {
      if (operation.current()) {
        setBusy(false);
        operation.finish();
      }
    }
  }
  return (
    <>
      <div className="eyebrow">YOUR WORKSPACE, YOUR CHOICE</div>
      <h1>Choose how you learn.</h1>
      <p className="lede">
        The campaign needs no account, API key, or model. Add a backend when you
        want saved accounts, AI coaching or isolated Docker Python and Bash.
      </p>
      <div className="settings-grid">
        <section className="panel">
          <h2>
            <Plug size={22} /> Connect a backend
          </h2>
          <form onSubmit={connect}>
            <fieldset>
            <label>
              Platform Forge backend URL
              <input
                disabled={!!account.session}
                type="url"
                placeholder="http://localhost:8787 (blank = this site)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <label>
              Backend access token
              <input
                disabled={!!account.session}
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Operator token; individuals can sign in from Account"
              />
            </label>
            <p className="muted">
              Use a Platform Forge API endpoint, not a model provider URL.
              Tokens stay in memory for this tab. Provider keys belong in the
              backend environment.
            </p>
            <button className="primary" disabled={busy}>
              <Zap size={16} />
              {busy ? "Checking endpoints…" : "Check connection"}
            </button>
            <button
              type="button"
              disabled={!!account.session}
              onClick={() => {
                check.current.cancel();
                setBusy(false);
                account.refreshAvailability({available:false});
                setSettings({ url: "", token: "" });
                setCapabilities({
                  tutor: false,
                  runner: false,
                  connected: false,
                });
                setUrl("");
                setToken("");
                setMessage(
                  "Disconnected. Standalone learning remains available.",
                );
              }}
            >
              Disconnect
            </button>
            </fieldset>
            {account.session && <p>Sign out from Account before changing backends.</p>}
          </form>
          {message && (
            <p className="connection-message" role="status">
              {message}
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Available capabilities</h2>
          {[
            ["Campaign, authored hints & notes", true],
            ["Python in the browser", true],
            ["Design Lab & interview practice", true],
            ["Account login & progress sync", account.availability?.available],
            ["Contextual AI mentor", capabilities.tutor],
            ["Managed runs & cancellation", capabilities.runnerJobs],
            ["Isolated Docker Python", capabilities.runner && (capabilities.runnerLanguages || ["python"]).includes("python")],
            ["Isolated Docker Bash", capabilities.runner && capabilities.runnerLanguages?.includes("bash")],
          ].map(([label, active]) => (
            <div className="capability" key={label}>
              <span className={`dot ${active ? "online" : ""}`} />
              <span>{label}</span>
              <strong>{active ? "Ready" : "Not connected"}</strong>
            </div>
          ))}
          <p className="muted">
            Connections are checked on request. If a service becomes
            unavailable, reconnect here; static lessons remain usable.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>
          <ShieldCheck size={22} /> Local and remote models
        </h2>
        <p>
          Run the Docker edition and set <code>LLM_BASE_URL</code>,{" "}
          <code>LLM_MODEL</code>, and optionally <code>LLM_API_KEY</code>. The
          gateway supports the OpenAI-compatible chat completions format,
          including compatible Ollama endpoints. Compatibility depends on the
          provider and model.
        </p>
        <p>
          Remote tutoring sends your question, current lesson, code, and output
          to the configured provider. Keep secrets out of practice code. You can
          use every core exercise without sending that content anywhere.
        </p>
        <p>
          GitHub Pages hosts the standalone frontend. To connect it to your own
          backend, use HTTPS and allow this exact site origin in{" "}
          <code>ALLOWED_ORIGINS</code>. Browser rules may block access from a
          public HTTPS page to a private or HTTP server; the Docker frontend
          avoids that cross-origin setup.
        </p>
      </section>
    </>
  );
}
