import { useState } from 'react';
import { UserRound, LogIn, UserPlus, CloudCheck, Download, LogOut } from 'lucide-react';
import { downloadProgress } from '../lib/account.mjs';

export default function Account({account,progress,navigate}) {
  const {session,availability,working,message} = account;
  const [mode,setMode]=useState('login'), [username,setUsername]=useState(''), [password,setPassword]=useState('');
  const [showLogin,setShowLogin]=useState(false);
  async function submit(event) {
    event.preventDefault();
    try { await account.authenticate(mode,username,password); setPassword(''); setShowLogin(false); } catch { setPassword(''); }
  }
  return <>
    <div className="eyebrow">YOUR LEARNING, SAVED</div>
    <h1>{session ? `Welcome, ${session.user.username}.` : 'Keep your progress with you.'}</h1>
    <p className="lede">Sign in to save missions, incident notes and design experiments across devices. You can always learn in guest mode.</p>
    <div className="account-grid">
      <section className="panel">
        <h2><UserRound size={22}/> {session ? 'Your account' : 'Sign in or create an account'}</h2>
        {session && <>
          <div className="account-status" role="status"><CloudCheck size={22}/><div><strong>{({saved:'Progress saved',pending:'Changes waiting to sync',syncing:'Saving your progress…',conflict:'Two copies need your attention',error:'Progress saved on this device'})[session.status]}</strong>
            <p>{session.error || (session.updatedAt ? `Last server save: ${new Date(session.updatedAt*1000).toLocaleString()}` : 'Your first changes will create an account save.')}</p></div></div>
          {session.status === 'conflict' && <div className="account-actions"><p>Export this device’s copy before replacing either version. No changes are merged automatically.</p>
            <button disabled={working} onClick={()=>account.resolveConflict(false)}>Use server copy</button>
            <button disabled={working} onClick={()=>account.resolveConflict(true)}>Replace server copy with this device</button>
          </div>}
          {session.status === 'error' && <button disabled={working} onClick={account.retrySync}>Retry sync</button>}
          <div className="account-actions">
            <button disabled={working || session.status==='conflict'} onClick={account.importGuest}>Import guest progress</button>
            <button onClick={()=>downloadProgress(progress)}><Download size={16}/> Export device copy</button>
            <button disabled={working} onClick={account.logout}><LogOut size={16}/> Sign out</button>
          </div>
          <p className="muted">Account notes take priority when importing guest work. Signing out restores this browser’s guest workspace.</p>
          {session.authExpired && <button onClick={()=>setShowLogin(true)}>Sign in again</button>}
        </>}
        {(!session || showLogin) && (availability?.available || session ? <form className="account-form" onSubmit={submit}>
          {!session && <div className="account-tabs" role="group" aria-label="Account action">
            <button type="button" aria-pressed={mode==='login'} onClick={()=>setMode('login')}><LogIn size={16}/> Sign in</button>
            {availability?.registration && <button type="button" aria-pressed={mode==='register'} onClick={()=>setMode('register')}><UserPlus size={16}/> Create account</button>}
          </div>}
          <label>Username<input name="username" autoComplete="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_\-]+" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Your username"/></label>
          <label>Password<input name="password" type="password" autoComplete={mode==='register'?'new-password':'current-password'} required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 12 characters"/></label>
          {mode==='register' && <p className="muted">Use 3–32 letters, numbers, underscores or dashes for your username. Usernames are case-insensitive.</p>}
          <button className="primary" disabled={working}>{working?'Connecting…':mode==='register'?'Create my account':'Sign in to my account'}</button>
          <p className="muted">Forgot your password? The server owner can reset it. Email recovery is not configured.</p>
        </form> : <div className="account-unavailable">
          <h3>{availability===null?'Checking account service…':'Connect a backend to sign in'}</h3>
          <p>The standalone GitHub Pages edition saves progress in this browser. Accounts need a Platform Forge backend to store your work.</p>
          <button className="primary" onClick={()=>navigate('Settings')}>Connect account backend</button>
        </div>)}
        {message && <p className="connection-message" role="status">{message}</p>}
      </section>
      <section className="panel account-summary">
        <div className="eyebrow">YOUR CURRENT WORKSPACE</div><h2>{session?'Account progress':'Guest progress'}</h2>
        <dl><div><dt>Practice attempts</dt><dd>{progress.attempts.length}</dd></div><div><dt>Design experiments</dt><dd>{progress.designs.length}</dd></div><div><dt>Incident notebooks</dt><dd>{Object.keys(progress.incidents || {}).length}</dd></div></dl>
        <p>Guest work stays on this device. After signing in, use <strong>Import guest progress</strong> to add it to your account.</p>
        <p>JSON exports remain your portable backup, whether you use an account or guest mode.</p>
        {!session && <button onClick={()=>downloadProgress(progress)}><Download size={16}/> Export guest progress</button>}
      </section>
    </div>
  </>;
}
