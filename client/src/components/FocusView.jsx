import { useEffect, useState } from 'react';
import { Play, Pause, Stop, SkipForward, Target, Timer, Coffee, Trophy } from '@phosphor-icons/react';
import { api } from '../api.js';
import { fmtClock } from '../hooks/useFocus.js';
import { fmtTime } from '../utils/date.js';

export default function FocusView({ focus, tasks, today, refreshKey }) {
  const { state, remaining, start, pause, resume, stop, skip, focusMin, breakMin } = focus;
  const [stats, setStats] = useState(null);
  const [pick, setPick] = useState('');
  useEffect(() => { api.focus(today).then(setStats).catch(() => {}); }, [today, refreshKey]);

  const pending = tasks.filter((t) => t.date <= today && t.status === 'pending');
  const total = state?.duration || focusMin * 60;
  const rem = state ? remaining : focusMin * 60;
  const pct = 1 - rem / total;
  const R = 130;
  const C = 2 * Math.PI * R;
  const maxDay = Math.max(30, ...(stats?.days || []).map((d) => d.minutes));

  return (
    <div className="focus-page">
      <div className={`focus-card ${state?.mode === 'break' ? 'break' : ''}`}>
        <div className="focus-mode">
          {state?.mode === 'break' ? <><Coffee size={16} /> Break · {breakMin} min</> : <><Target size={16} /> Focus · {focusMin} min</>}
          {state?.round ? <span className="muted"> · Round {state.round}</span> : null}
        </div>
        <div className="focus-dial">
          <svg viewBox="0 0 300 300">
            <defs>
              <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent-2)" /><stop offset="50%" stopColor="var(--accent)" /><stop offset="100%" stopColor="var(--accent-3)" />
              </linearGradient>
            </defs>
            <circle cx="150" cy="150" r={R} className="dial-track" />
            <circle cx="150" cy="150" r={R} className="dial-fill" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
          </svg>
          <div className="dial-center">
            <div className="dial-time">{fmtClock(rem)}</div>
            <div className="dial-task">{state?.title || 'Kis kaam par focus karna hai?'}</div>
          </div>
        </div>

        {!state && (
          <div className="focus-pick">
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Deep work (koi specific task nahi)</option>
              {pending.map((t) => <option key={t.id} value={t.id}>{t.title}{t.time ? ` · ${fmtTime(t.time)}` : ''}</option>)}
            </select>
          </div>
        )}

        <div className="focus-controls">
          {!state && <button className="btn primary big" onClick={() => start(pending.find((t) => t.id === pick))}><Play size={18} weight="fill" /> Start focus</button>}
          {state && (
            <>
              {state.running
                ? <button className="round-btn primary" onClick={pause} title="Pause"><Pause size={26} weight="fill" /></button>
                : <button className="round-btn primary" onClick={resume} title="Play"><Play size={26} weight="fill" /></button>}
              <button className="round-btn" onClick={skip} title="Skip"><SkipForward size={22} weight="fill" /></button>
              <button className="round-btn" onClick={stop} title="Stop"><Stop size={22} weight="fill" /></button>
            </>
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3><Timer size={18} /> Focus stats</h3>
          <div className="focus-kpis">
            <div><b>{stats?.todayMinutes ?? 0}<small>m</small></b><span>Today</span></div>
            <div><b>{stats?.todaySessions ?? 0}</b><span>Sessions</span></div>
            <div><b>{Math.round(((stats?.weekMinutes ?? 0) / 60) * 10) / 10}<small>h</small></b><span>This week</span></div>
          </div>
          <div className="mini-bars">
            {(stats?.days || []).map((d) => (
              <div key={d.date} className={d.date === today ? 'today' : ''} title={`${d.date}: ${d.minutes} min`}>
                <i style={{ height: `${(d.minutes / maxDay) * 100}%` }} />
                <span>{new Date(`${d.date}T00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3><Trophy size={18} /> Sab se zyada time (7 din)</h3>
          {!stats?.top?.length && <p className="muted">Abhi koi session nahi. Kisi task par ▶ dabayein.</p>}
          {stats?.top?.map((t) => (
            <div key={t.title} className="cat-row">
              <span className="ellipsis">{t.title}</span>
              <div className="cat-track"><div style={{ width: `${(t.minutes / stats.top[0].minutes) * 100}%`, background: 'var(--grad)' }} /></div>
              <span className="muted mono">{t.minutes}m</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FocusMini({ focus, onOpen }) {
  const { state, remaining, pause, resume, stop } = focus;
  if (!state) return null;
  return (
    <div className={`focus-mini ${state.mode}`}>
      <button className="fm-main" onClick={onOpen}>
        {state.mode === 'break' ? <Coffee size={17} /> : <Target size={17} />}
        <b className="mono">{fmtClock(remaining)}</b>
        <span className="ellipsis">{state.title}</span>
      </button>
      {state.running ? <button className="icon-btn" onClick={pause}><Pause size={16} weight="fill" /></button> : <button className="icon-btn" onClick={resume}><Play size={16} weight="fill" /></button>}
      <button className="icon-btn" onClick={stop}><Stop size={16} weight="fill" /></button>
    </div>
  );
}
