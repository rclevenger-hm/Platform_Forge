import { useRef } from 'react';
export default function WorkspaceTabs({tabs, value, onChange}) {
  const refs = useRef([]);
  return <div className="workspace-tabs" role="tablist" aria-label="Mission workspace views">
    {tabs.map((name,i) => <button key={name} ref={node => { refs.current[i] = node; }} role="tab" id={`workspace-tab-${name}`} aria-controls={`workspace-panel-${name}`} aria-selected={value === name} tabIndex={value === name ? 0 : -1} onClick={() => onChange(name)} onKeyDown={e => {
      let next;
      if (e.key === 'ArrowRight') next = (i+1)%tabs.length;
      if (e.key === 'ArrowLeft') next = (i-1+tabs.length)%tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length-1;
      if (next !== undefined) { e.preventDefault(); onChange(tabs[next]); refs.current[next]?.focus(); }
    }}>{name}</button>)}
  </div>;
}
