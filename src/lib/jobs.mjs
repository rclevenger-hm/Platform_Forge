import { request } from './api.mjs';
export const TERMINAL = ['succeeded','failed','cancelled','timed_out','output_limit','error'];
const STATES = ['starting','running','cancelling',...TERMINAL];
const EVENTS = ['accepted','running','cancel_requested',...TERMINAL,'cleanup_confirmed','cleanup_pending'];
const date = x => typeof x === 'string' && x.length <= 40 && Number.isFinite(Date.parse(x));
export function cleanRun(value, completedOnly=false) {
  if (!value || !/^[a-f0-9]{32}$/.test(value.id) || !/^[A-Z][A-Z0-9_-]{1,39}$/.test(value.missionId)
      || !Number.isInteger(value.missionVersion) || value.missionVersion < 1 || !STATES.includes(value.state)
      || (completedOnly && !TERMINAL.includes(value.state)) || !date(value.createdAt)
      || (TERMINAL.includes(value.state) && !date(value.finishedAt)) || !['confirmed','pending'].includes(value.cleanup)) return null;
  const image = value.image && typeof value.image.reference === 'string' && /^sha256:[a-f0-9]{64}$/.test(value.image.id)
    ? {reference:value.image.reference.slice(0,200),id:value.image.id,digests:Array.isArray(value.image.digests)?value.image.digests.filter(d=>typeof d==='string' && d.length<=300).slice(0,5):[]} : null;
  return {id:value.id,missionId:value.missionId,missionVersion:value.missionVersion,state:value.state,
    passed:value.state==='succeeded' && value.passed===true, createdAt:value.createdAt,
    startedAt:date(value.startedAt)?value.startedAt:null, finishedAt:date(value.finishedAt)?value.finishedAt:null,
    recordExpiresAt:date(value.recordExpiresAt)?value.recordExpiresAt:null, maxRunSeconds:10,
    output:typeof value.output==='string'?value.output.slice(0,16500):'',cleanup:value.cleanup,image,
    events:Array.isArray(value.events)?value.events.filter(e=>e && date(e.at) && EVENTS.includes(e.event)).slice(-20).map(e=>({at:e.at,event:e.event})):[]};
}
export function runLabel(state) {
  return ({starting:'Starting',running:'Running',cancelling:'Cancelling',succeeded:'Checks passed',failed:'Checks failed',cancelled:'Cancelled',timed_out:'Time limit reached',output_limit:'Output limit reached',error:'Runner unavailable'})[state] || state;
}
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
export function startManagedRun(settings, mission, code, onUpdate) {
  const id=crypto.randomUUID().replaceAll('-','');
  let cancelRequested=false, accepted=false;
  async function cancel() {
    cancelRequested=true;
    if (accepted) return request(settings,`jobs/${id}/cancel`,{});
  }
  const done=(async()=>{
    try {
      let record=await request(settings,'jobs',{jobId:id,missionId:mission.id,code});
      accepted=true;
      if (cancelRequested) record=await request(settings,`jobs/${id}/cancel`,{});
      const deadline=Date.now()+35000;
      while (true) {
        record=cleanRun(record);
        if (!record || record.id!==id || record.missionId!==mission.id || record.missionVersion!==mission.version) throw Error('Runner returned an incompatible job record. Reconnect or update the backend.');
        onUpdate(record);
        if (TERMINAL.includes(record.state)) return record;
        if (Date.now()>deadline) throw Error('Run status could not be confirmed. The runner enforces its own execution deadline.');
        await pause(400);
        record=await request(settings,`jobs/${id}`);
      }
    } catch (error) {
      // The client-generated ID also lets us cancel if the create response was lost.
      await request(settings,`jobs/${id}/cancel`,{}).catch(()=>{});
      throw error;
    }
  })();
  return {id,done,cancel};
}
