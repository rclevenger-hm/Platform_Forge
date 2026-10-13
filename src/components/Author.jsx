import { useMemo, useRef, useState } from 'react';
import { Download, Upload, FileCode2 } from 'lucide-react';
import { CONCEPTS, validateCurriculum } from '../lib/curriculum.mjs';
export default function Author({ missions, tracks, progress, setProgress }) {
  const [selected, setSelected] = useState(missions[0].id), [message, setMessage] = useState('');
  const input = useRef();
  const source = progress.authorDraft || JSON.stringify(missions[0], null, 2);
  const validation = useMemo(() => {
    try {
      if (source.length > 250000) throw Error('Mission JSON must be smaller than 250 KB.');
      const mission = JSON.parse(source);
      const errors = validateCurriculum([...missions.filter(m => m.id !== mission?.id), mission], tracks);
      return { mission, errors };
    } catch (e) { return { mission: null, errors: [e.message] }; }
  }, [source, missions, tracks]);
  const edit = value => setProgress(p => ({ ...p, authorDraft: value }));
  function load() {
    if (progress.authorDraft && !window.confirm('Replace this local authoring draft? Export it first to keep a separate copy.')) return;
    edit(JSON.stringify(missions.find(m => m.id === selected), null, 2));
    setMessage('Lesson copied into your local draft. Change its ID to create a new mission.');
  }
  async function importFile(e) {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 250000) throw Error('Mission JSON must be smaller than 250 KB.');
      const text = await file.text();
      if (progress.authorDraft && !window.confirm('Replace your local authoring draft with this file?')) return;
      edit(text); setMessage('Draft imported. Review validation before exporting.');
    } catch (e) { setMessage(e.message); }
    finally { e.target.value = ''; }
  }
  function download() {
    if (validation.errors.length) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(validation.mission, null, 2) + '\n'], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${validation.mission.id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Validated lesson exported. Add it to the repository curriculum for review and testing.');
  }
  const m = validation.mission, valid = validation.errors.length === 0;
  return <>
    <div className="eyebrow">BUILD THE NEXT MISSION</div><h1>The authoring workbench.</h1>
    <p className="lede">Turn one operational lesson into a briefing, a challenge, and observable evidence. Your draft stays in this browser and in progress backups.</p>
    <div className="toolbar">
      <select aria-label="Mission template" value={selected} onChange={e => setSelected(e.target.value)}>{missions.map(m => <option key={m.id} value={m.id}>{m.id} · {m.title}</option>)}</select>
      <button onClick={load}><FileCode2 size={16}/> Copy template</button>
      <button onClick={() => input.current.click()}><Upload size={16}/> Import lesson</button>
      <button className="primary" disabled={!valid} onClick={download}><Download size={16}/> Export validated lesson</button>
      <input ref={input} hidden type="file" accept=".json,application/json" onChange={importFile}/>
    </div>
    {message && <p role="status">{message}</p>}
    <div className="author-grid">
      <section className="panel"><label htmlFor="author-source"><strong>Mission JSON</strong></label><p className="muted">Use a unique ID for a new lesson. Increase version when changing an existing challenge’s learning contract.</p>
        <textarea id="author-source" className="author-editor" spellCheck="false" value={source} maxLength={250000} onChange={e => edit(e.target.value)}/>
      </section>
      <section className="panel author-preview" aria-label="Lesson preview">
        <span className={`tag ${valid ? 'lime' : ''}`} role="status">{valid ? 'VALID MISSION CONTRACT' : 'DRAFT NEEDS CHANGES'}</span>
        {!valid ? <ul className="author-errors">{validation.errors.map((e,i) => <li key={i}>{e}</li>)}</ul> : <>
          <div className="eyebrow">{m.id} · VERSION {m.version} · {m.minutes} MIN</div><h2>{m.title}</h2><p>{m.summary}</p>
          {m.lesson.map((p,i) => <p key={i}>{p}</p>)}<div className="objective"><strong>Your mission</strong><p>{m.objective}</p></div>
          <h3>Concept evidence</h3><ul>{m.concepts.map(c => <li key={c}>{CONCEPTS[c]}</li>)}</ul>
          <h3>{m.quiz[0]}</h3><ol>{m.quiz.slice(1).map((a,i) => <li key={i}>{a}{i === m.answer ? ' · correct' : ''}</li>)}</ol><p>{m.why}</p>
          <details><summary>Review authored checks</summary><pre>{m.tests || JSON.stringify(m.checks, null, 2)}</pre>{m.cases && <pre>{JSON.stringify(m.cases, null, 2)}</pre>}</details>
        </>}
        <p className="footnote">Preview does not execute imported code or add it to the live campaign. Export the lesson, review its code, and run the repository checks before publishing.</p>
      </section>
    </div>
  </>;
}
