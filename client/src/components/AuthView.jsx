import { useState } from 'react';
import { Sparkle, Envelope, Lock, User, ArrowRight, CircleNotch, Bell, Robot, Fire, Target } from '@phosphor-icons/react';
import { api, setToken } from '../api.js';

export default function AuthView({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = mode === 'login' ? await api.login(f) : await api.register(f);
      setToken(r.token);
      onAuthed(r.user);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="bg-glow" />
      <div className="auth-side">
        <div className="brand big"><div className="logo"><Sparkle size={20} weight="fill" /></div><span>DayMate <b>AI</b></span></div>
        <h1>Aap ka din, <span className="grad-text">organized.</span></h1>
        <p className="muted">Todos, waqt par reminders, habits, focus timer aur ek AI agent jo roz poochta hai: aaj kya kiya, kal kya karna hai?</p>
        <ul className="auth-points">
          <li><Bell size={18} /> Phone, Telegram aur WhatsApp par reminders</li>
          <li><Robot size={18} /> AI agent jo aap ka din plan kare</li>
          <li><Fire size={18} /> Habits aur streaks</li>
          <li><Target size={18} /> Focus timer aur weekly reports</li>
        </ul>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Account banayein'}</h2>
        <p className="muted small">{mode === 'login' ? 'Apne account mein login karein' : 'Sirf 30 second lagenge'}</p>
        {mode === 'register' && (
          <label className="auth-field"><User size={18} /><input placeholder="Aap ka naam" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        )}
        <label className="auth-field"><Envelope size={18} /><input type="email" required placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
        <label className="auth-field"><Lock size={18} /><input type="password" required minLength={6} placeholder="Password (6+ characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {err && <div className="auth-err">{err}</div>}
        <button className="btn primary big" disabled={busy}>
          {busy ? <CircleNotch size={18} className="spin" /> : <>{mode === 'login' ? 'Login' : 'Create account'} <ArrowRight size={18} weight="bold" /></>}
        </button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
          {mode === 'login' ? 'Naya account? Sign up karein' : 'Pehle se account hai? Login karein'}
        </button>
      </form>
    </div>
  );
}
