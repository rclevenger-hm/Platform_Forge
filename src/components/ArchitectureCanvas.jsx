import { useRef, useState } from 'react';
import { Users, Network, Server, Layers, Database, ListOrdered, Workflow, Plus, Trash2 } from 'lucide-react';
import { COMPONENTS, CONNECTIONS, addComponent, removeComponent, connect } from '../lib/architecture.mjs';
const icons = {clients:Users,balancer:Network,api:Server,cache:Layers,database:Database,queue:ListOrdered,worker:Workflow};
export default function ArchitectureCanvas({graph, onChange, config}) {
  const [selected, setSelected] = useState('api'), [connection, setConnection] = useState('');
  const canvas = useRef(), drag = useRef(null);
  const available = CONNECTIONS.filter(([a,b]) => graph.nodes.some(n => n.id === a) && graph.nodes.some(n => n.id === b) && !graph.edges.some(e => e.from === a && e.to === b));
  function move(id,x,y) { onChange({...graph,nodes:graph.nodes.map(n => n.id === id ? {...n,x:Math.min(90,Math.max(10,x)),y:Math.min(82,Math.max(18,y))} : n)}); }
  const display = id => id === 'api' ? `${config.nodes} replicas${config.failed ? ' · one down' : ''}` : id === 'worker' ? `${config.workers} workers${config.workerFailed ? ' · stopped' : ''}` : id === 'cache' ? `${config.cache}% hit target` : id === 'database' ? `${config.db} ops/s` : id === 'queue' ? `${config.queueLimit} job buffer` : 'Request path';
  return <div className="architecture-editor">
    <div className="component-palette" aria-label="Add architecture components">{Object.entries(COMPONENTS).filter(([id]) => !graph.nodes.some(n => n.id === id)).map(([id,item]) => <button key={id} onClick={() => onChange(addComponent(graph,id))}><Plus size={14}/>{item.label}</button>)}</div>
    <p className="canvas-instructions" id="canvas-help">Drag components to arrange them. Keyboard: focus a component and use arrow keys. Connect or remove components below.</p>
    <div className="architecture-canvas" ref={canvas}>
      <svg viewBox="0 0 900 460" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#6cbaac"/></marker></defs>{graph.edges.map(e => {
        const a = graph.nodes.find(n => n.id === e.from), b = graph.nodes.find(n => n.id === e.to);
        const dx=(b.x-a.x)*9, dy=(b.y-a.y)*4.6, distance=Math.hypot(dx,dy), inset=Math.min(54,distance/3);
        return <line key={`${e.from}-${e.to}`} x1={a.x*9} y1={a.y*4.6} x2={b.x*9-(distance ? dx/distance*inset : 0)} y2={b.y*4.6-(distance ? dy/distance*inset : 0)} stroke="#6cbaac" strokeWidth="2" markerEnd="url(#flow-arrow)"/>;
      })}</svg>
      {graph.nodes.map(n => { const Icon = icons[n.id]; return <button key={n.id} className={`graph-node ${selected === n.id ? 'selected' : ''} ${n.id === 'api' && config.failed || n.id === 'worker' && config.workerFailed || n.id === 'database' && config.dbFailed ? 'faulted' : ''}`} style={{left:`${n.x}%`,top:`${n.y}%`}} aria-label={`${COMPONENTS[n.id].label} node`} aria-describedby="canvas-help" aria-pressed={selected === n.id} onClick={() => setSelected(n.id)}
        onKeyDown={e => {const steps = {ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2]}; if (steps[e.key]) {e.preventDefault(); const [x,y] = steps[e.key];move(n.id,n.x+x*(e.shiftKey?5:1),n.y+y*(e.shiftKey?5:1));}}}
        onPointerDown={e => {if (e.button !== 0) return; setSelected(n.id); const rect = canvas.current.getBoundingClientRect(); drag.current={id:n.id,startX:e.clientX,startY:e.clientY,x:n.x,y:n.y,width:rect.width,height:rect.height}; e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e => {const d=drag.current;if (d?.id === n.id) move(n.id,d.x+(e.clientX-d.startX)/d.width*100,d.y+(e.clientY-d.startY)/d.height*100);}}
        onPointerUp={() => {drag.current=null;}} onPointerCancel={() => {drag.current=null;}}>
        <Icon size={24}/><strong>{COMPONENTS[n.id].label}</strong><small>{display(n.id)}</small>
      </button>;})}
    </div>
    <div className="graph-tools">
      <label>New connection<select aria-label="Architecture connection" value={available.some(([a,b]) => `${a}:${b}` === connection) ? connection : ''} onChange={e => setConnection(e.target.value)}><option value="">Choose a path…</option>{available.map(([a,b]) => <option key={`${a}:${b}`} value={`${a}:${b}`}>{COMPONENTS[a].label} → {COMPONENTS[b].label}</option>)}</select></label>
      <button disabled={!available.some(([a,b]) => `${a}:${b}` === connection)} onClick={() => {onChange(connect(graph,...connection.split(':')));setConnection('');}}>Connect components</button>
      <button disabled={selected === 'clients' || !graph.nodes.some(n => n.id === selected)} onClick={() => onChange(removeComponent(graph,selected))}><Trash2 size={14}/>Remove {COMPONENTS[selected].label}</button>
    </div>
    <details><summary>Inspect and remove connections ({graph.edges.length})</summary><ul className="edge-list">{graph.edges.map(e => <li key={`${e.from}:${e.to}`}><span>{COMPONENTS[e.from].label} → {COMPONENTS[e.to].label}</span><button aria-label={`Remove ${COMPONENTS[e.from].label} to ${COMPONENTS[e.to].label} connection`} onClick={() => onChange({...graph,edges:graph.edges.filter(x => x !== e)})}>Remove</button></li>)}</ul></details>
  </div>;
}
