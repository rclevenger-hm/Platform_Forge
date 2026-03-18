import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { request } from "../lib/api.mjs";
export default function Tutor({
  mission,
  code,
  output,
  settings,
  capabilities,
  onHelp,
}) {
  const [prompt, setPrompt] = useState(""),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false);
  async function ask(e) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setBusy(true);
    onHelp();
    try {
      const r = await request(settings, "tutor", {
        missionId: mission.id,
        question: prompt,
        code: code.slice(0, 12000),
        output: output.slice(-4000),
      });
      setAnswer(r.answer);
    } catch (e) {
      setAnswer(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel tutor">
      <h3>
        <Sparkles size={18} /> Forge mentor{" "}
        <span className={`dot ${capabilities.tutor ? "online" : ""}`} />
      </h3>
      {capabilities.tutor ? (
        <>
          <p className="muted">
            AI hints use this lesson, your editor, and the latest output.
            Answers can be mistaken; practice checks decide completion.
          </p>
          <form onSubmit={ask}>
            <textarea
              aria-label="Ask the mentor"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={2000}
              placeholder="Why is this failing? Give me a small hint."
            />
            <button disabled={busy || !prompt.trim()}>
              {busy ? (
                "Thinking…"
              ) : (
                <>
                  <Send size={15} /> Ask for a hint
                </>
              )}
            </button>
          </form>
          {answer && (
            <div className="ai-answer" role="status">
              {answer}
            </div>
          )}
        </>
      ) : (
        <p>
          Authored hints are always available above. Connect a local or remote
          model in Settings to add contextual explanations and Socratic
          coaching.
        </p>
      )}
    </section>
  );
}
