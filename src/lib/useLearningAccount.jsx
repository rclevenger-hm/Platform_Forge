import { useEffect, useRef, useState } from 'react';
import { KEY, fresh, readProgress, validateProgress } from './progress.mjs';
import { request } from './api.mjs';
import { accountKey, mergeGuestProgress } from './account.mjs';

export default function useLearningAccount(settings, setSettings, setCapabilities) {
  const [progress, setRawProgress] = useState(() => { try { return readProgress(localStorage); } catch { return fresh(); } });
  const [session, setRawSession] = useState(null), [availability, setAvailability] = useState(null);
  const [message, setMessage] = useState(''), [working, setWorking] = useState(false), [storageError, setStorageError] = useState('');
  const [retry, setRetry] = useState(0);
  const current = useRef(progress), active = useRef(null), saved = useRef(''), blocked = useRef(false), flight = useRef(null), generation = useRef(0);
  const config = useRef(settings); config.current = settings;
  function setProgress(value) {
    const next = typeof value === 'function' ? value(current.current) : value;
    current.current = next; setRawProgress(next);
  }
  function setSession(value) { active.current = value; setRawSession(value); }
  function changeSession(patch) { if (active.current) setSession({...active.current,...patch}); }
  function cache() {
    try {
      const s = active.current;
      if (s) localStorage.setItem(s.key, JSON.stringify({revision:s.revision, progress:current.current, dirty:JSON.stringify(current.current)!==saved.current}));
      else localStorage.setItem(KEY, JSON.stringify(current.current));
      setStorageError('');
    } catch { setStorageError('Browser storage is unavailable or full. Export your progress before closing this tab.'); }
  }
  async function sync() {
    if (flight.current) return flight.current;
    const s = active.current;
    if (!s || JSON.stringify(current.current) === saved.current) return;
    const identity = generation.current, snapshot = current.current, serialized = JSON.stringify(snapshot);
    changeSession({status:'syncing',error:''});
    const operation = (async () => {
      try {
        const result = await request({...config.current,csrf:s.csrf},'account/progress',{revision:s.revision,progress:snapshot});
        if (identity !== generation.current) return;
        saved.current = serialized; blocked.current = false;
        changeSession({revision:result.revision,updatedAt:result.updatedAt,status:'saved',error:''});
        cache();
      } catch (error) {
        if (identity === generation.current) {
          blocked.current = true;
          changeSession({status:error.status === 409 ? 'conflict' : 'error',error:error.message,authExpired:error.status === 401 || error.status === 403});
          cache();
        }
        throw error;
      } finally { flight.current = null; }
    })();
    flight.current = operation;
    return operation;
  }
  async function hydrate(auth, identity=generation.current) {
    const result = await request({...config.current,csrf:auth.csrf},'account/progress');
    if (identity !== generation.current) return;
    const remote = result.progress ? validateProgress(result.progress) : fresh();
    const key = accountKey(config.current.url,auth.user.id);
    let local;
    try {
      const entry = JSON.parse(localStorage.getItem(key));
      if (entry?.dirty && Number.isInteger(entry.revision)) local = {...entry,progress:validateProgress(entry.progress)};
    } catch { /* Invalid cache must not discard a valid account snapshot. */ }
    const conflict = local && local.revision !== result.revision;
    saved.current = JSON.stringify(remote); blocked.current = !!conflict;
    setSession({user:auth.user,csrf:auth.csrf,key,revision:result.revision,status:conflict ? 'conflict' : 'saved',updatedAt:result.updatedAt,
      error:conflict ? 'This device has unsynced work and the server copy also changed. Choose which copy to keep.' : ''});
    setSettings(value => ({...value,csrf:auth.csrf}));
    setProgress(local ? local.progress : remote);
    request({...config.current,csrf:auth.csrf},'capabilities').then(setCapabilities).catch(() => {});
  }
  useEffect(() => {
    const identity = ++generation.current;
    let alive = true;
    request(config.current,'auth/status').then(async status => {
      if (!alive || identity !== generation.current) return;
      setAvailability(status);
      if (status.user) {
        try { await hydrate(status,identity); }
        catch(error) { setMessage(`Could not restore account progress: ${error.message}`); }
      }
    }).catch(() => { if (alive) setAvailability({available:false}); });
    return () => { alive=false; generation.current++; };
  }, [settings.url]);
  useEffect(() => {
    cache();
    if (!session || JSON.stringify(progress) === saved.current || blocked.current) return;
    changeSession({status:'pending'});
    const timer=setTimeout(() => sync().catch(() => {}),800);
    return () => clearTimeout(timer);
  }, [progress,session?.user.id,session?.revision,retry]);
  useEffect(() => {
    const warn = event => {
      if (active.current && JSON.stringify(current.current) !== saved.current) { event.preventDefault(); event.returnValue=''; }
    };
    addEventListener('beforeunload',warn); return () => removeEventListener('beforeunload',warn);
  }, []);
  async function authenticate(mode, username, password) {
    setWorking(true); setMessage('');
    const identity=++generation.current;
    cache();
    try {
      const auth=await request(config.current,`auth/${mode}`,{username,password});
      await hydrate(auth,identity);
      setMessage('Signed in. Progress saves to your account as you learn.');
    } catch(error) { setMessage(error.message); throw error; }
    finally { setWorking(false); }
  }
  async function logout() {
    setWorking(true); setMessage('');
    try {
      if (blocked.current && JSON.stringify(current.current)!==saved.current) throw Error('Resolve the sync issue before signing out. Export a device copy first if you want to keep both versions.');
      await sync();
      if (JSON.stringify(current.current)!==saved.current) await sync();
      const s=active.current;
      await request({...config.current,csrf:s.csrf},'auth/logout',{});
      generation.current++; localStorage.removeItem(s.key);
      setSession(null); saved.current=''; blocked.current=false;
      setSettings(value=>({...value,csrf:''})); setCapabilities({connected:false,runner:false,tutor:false});
      setProgress(readProgress(localStorage));
      setMessage('Signed out. Guest progress is separate from your account.');
    } catch(error) { setMessage(error.message); }
    finally { setWorking(false); }
  }
  async function resolveConflict(useDevice) {
    setWorking(true); setMessage('');
    try {
      if (flight.current) await flight.current;
      const s=active.current;
      const remote=await request({...config.current,csrf:s.csrf},'account/progress');
      const clean=remote.progress ? validateProgress(remote.progress) : fresh();
      saved.current=JSON.stringify(clean); blocked.current=false;
      changeSession({revision:remote.revision,status:'saved',error:'',updatedAt:remote.updatedAt});
      if (useDevice) await sync(); else setProgress(clean);
      cache();
    } catch(error) { blocked.current=true; changeSession({status:'error',error:error.message}); }
    finally { setWorking(false); }
  }
  return {progress,setProgress,storageError,account:{session,availability,message,working,authenticate,logout,resolveConflict,
    refreshAvailability:status=>setAvailability(status),
    retrySync:()=>{blocked.current=false;setRetry(n=>n+1);},
    importGuest:()=>{setProgress(mergeGuestProgress(current.current,readProgress(localStorage)));setMessage('Guest work copied. Existing account notes take priority.');},
    syncNow:()=>sync().catch(()=>{}),
  }};
}
