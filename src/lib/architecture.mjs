import { defaults, simulate } from './simulator.mjs';
export const COMPONENTS = {
  clients:{label:'Clients',x:10,y:45},
  balancer:{label:'Load balancer',x:28,y:45},
  api:{label:'API service',x:47,y:45},
  cache:{label:'Cache',x:69,y:20},
  database:{label:'Database',x:89,y:45},
  queue:{label:'Queue',x:47,y:79},
  worker:{label:'Worker',x:70,y:79},
};
export const CONNECTIONS = [
  ['clients','balancer'],['clients','api'],['balancer','api'],['api','cache'],
  ['cache','database'],['api','database'],['api','queue'],['queue','worker'],['worker','database'],
];
export const designDefaults = {...defaults, jobs:0, workers:2, workerFailed:false, dbFailed:false, queueLimit:1000, initialBacklog:0, seconds:60};
export function defaultGraph() {
  return {version:1,nodes:['clients','balancer','api','cache','database'].map(id => ({id,x:COMPONENTS[id].x,y:COMPONENTS[id].y})),edges:CONNECTIONS.slice(0,6).filter(([a,b]) => !(a === 'clients' && b === 'api')).map(([from,to]) => ({from,to}))};
}
export function cleanGraph(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.nodes) || !value.nodes.length || value.nodes.length > 7 || !Array.isArray(value.edges) || value.edges.length > CONNECTIONS.length) throw Error('Unsupported architecture graph.');
  const ids = new Set();
  const nodes = value.nodes.map(n => {
    if (!n || !Object.hasOwn(COMPONENTS,n.id) || ids.has(n.id) || !Number.isFinite(n.x) || !Number.isFinite(n.y)) throw Error('Invalid or duplicate architecture component.');
    ids.add(n.id);return {id:n.id,x:Math.min(90,Math.max(10,n.x)),y:Math.min(82,Math.max(18,n.y))};
  });
  const used = new Set();
  const edges = value.edges.map(e => {
    const key = `${e?.from}:${e?.to}`;
    if (!e || !ids.has(e.from) || !ids.has(e.to) || used.has(key) || !CONNECTIONS.some(([a,b]) => a === e.from && b === e.to)) throw Error('Unsupported or dangling architecture connection.');
    used.add(key);return {from:e.from,to:e.to};
  });
  return {version:1,nodes,edges};
}
export function cleanDesignConfig(input = {}) {
  const o = input && typeof input === 'object' ? input : {};
  const bounds = {traffic:[100,10000],nodes:[1,10],cache:[0,95],db:[100,3000],jobs:[0,3000],workers:[1,10],queueLimit:[100,10000],initialBacklog:[0,10000],seconds:[10,300]};
  const result = {};
  for (const [key,[lo,hi]] of Object.entries(bounds)) result[key] = Number.isFinite(o[key]) ? Math.min(hi,Math.max(lo,Math.round(o[key]))) : designDefaults[key];
  for (const key of ['failed','workerFailed','dbFailed']) result[key] = o[key] === true;
  result.initialBacklog = Math.min(result.initialBacklog,result.queueLimit);
  return result;
}
export function addComponent(graph, id) {
  if (!Object.hasOwn(COMPONENTS,id) || graph.nodes.some(n => n.id === id)) return graph;
  return {...graph,nodes:[...graph.nodes,{id,x:COMPONENTS[id].x,y:COMPONENTS[id].y}]};
}
export function removeComponent(graph,id) {
  if (id === 'clients') return graph;
  return {...graph,nodes:graph.nodes.filter(n => n.id !== id),edges:graph.edges.filter(e => e.from !== id && e.to !== id)};
}
export function connect(graph,from,to) {
  if (!CONNECTIONS.some(([a,b]) => a === from && b === to) || ![from,to].every(id => graph.nodes.some(n => n.id === id)) || graph.edges.some(e => e.from === from && e.to === to)) return graph;
  return {...graph,edges:[...graph.edges,{from,to}]};
}
export function withQueue(graph) {
  let result = addComponent(addComponent(graph,'queue'),'worker');
  for (const [from,to] of [['api','queue'],['queue','worker'],['worker','database']]) result = connect(result,from,to);
  return result;
}
export function simulateDesign(input, rawGraph) {
  const config = cleanDesignConfig(input), graph = cleanGraph(rawGraph);
  const node = id => graph.nodes.some(n => n.id === id);
  const edge = (from,to) => graph.edges.some(e => e.from === from && e.to === to);
  const ingress = edge('clients','api') || (edge('clients','balancer') && edge('balancer','api'));
  const cacheConnected = edge('api','cache') && edge('cache','database');
  const readRoute = ingress && (edge('api','database') || cacheConnected);
  const diagnostics = [];
  if (!ingress) diagnostics.push('Connect clients to the API, directly or through the load balancer.');
  if (!edge('api','database') && !cacheConnected) diagnostics.push('Connect the API to the database, directly or through the cache.');
  if (node('cache') && !cacheConnected) diagnostics.push('The disconnected cache provides no hits.');
  if (config.dbFailed) diagnostics.push('The database is unavailable. This model treats database access as required.');
  const cache = cacheConnected ? config.cache : 0;
  let foreground = simulate({...config,cache});
  if (!readRoute || config.dbFailed) foreground = {...foreground,capacity:0,utilization:Infinity,overloaded:true,error:100,p95:null,dbTraffic:0,bottleneck:'Disconnected or unavailable request path'};
  if (!node('api')) foreground = {...foreground,active:0,nodes:0};
  // Foreground reads have priority. Each processed job requires one DB operation.
  const admittedReadRate = readRoute && !config.dbFailed ? Math.min(config.traffic, foreground.active * 600) : 0;
  const dbUsed = Math.min(config.db,admittedReadRate * (1-cache/100));
  const spareDb = config.dbFailed ? 0 : Math.max(0,config.db-dbUsed);
  const enqueueReady = node('queue') && ingress && edge('api','queue') && foreground.active > 0;
  const processingPath = edge('queue','worker') && edge('worker','database');
  const queueRoute = enqueueReady && processingPath;
  const activeWorkers = node('worker') && !config.workerFailed ? config.workers : 0;
  const drainRate = processingPath && !config.dbFailed ? Math.min(activeWorkers*300,spareDb) : 0;
  const arrivals = config.jobs*config.seconds;
  const initial = node('queue') ? config.initialBacklog : 0;
  const available = initial + (enqueueReady ? arrivals : 0);
  const processed = Math.min(available,drainRate*config.seconds);
  const overflow = Math.max(0,available-processed-config.queueLimit);
  const rejected = (enqueueReady ? 0 : arrivals) + overflow + (node('queue') ? 0 : config.initialBacklog);
  const backlog = Math.min(config.queueLimit,Math.max(0,available-processed));
  if (config.jobs > 0 && !enqueueReady) diagnostics.push('To enqueue background jobs, connect clients to an active API and connect the API to a queue.');
  if ((config.jobs > 0 || config.initialBacklog > 0) && node('queue') && !drainRate) diagnostics.push('Jobs cannot drain: connect queue → worker → database, restore workers, and leave database capacity for background work.');
  const cost = (node('api') ? config.nodes*30 : 0) + (node('database') ? Math.round(config.db/20) : 0) + (node('cache') ? 20 : 0) + (node('balancer') ? 10 : 0) + (node('queue') ? 15 : 0) + (node('worker') ? config.workers*20 : 0);
  return {...foreground,cost,diagnostics,cacheConnected,readRoute,queue:{enabled:node('queue'),route:queueRoute,arrivals,processed,rejected,backlog,drainRate,activeWorkers,drainSeconds:backlog ? drainRate ? Math.ceil(backlog/drainRate) : null : 0},config};
}
export const SCENARIOS = [
  {id:'normal',title:'Current conditions',change:c => c},
  {id:'spike',title:'Double the traffic',change:c => ({...c,traffic:Math.min(10000,c.traffic*2)})},
  {id:'replica',title:'Lose an API replica',change:c => ({...c,failed:true})},
  {id:'cold',title:'Cold cache',change:c => ({...c,cache:0})},
  {id:'worker',title:'Workers stopped',change:c => ({...c,workerFailed:true})},
];
