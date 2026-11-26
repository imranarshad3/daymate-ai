import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun, CalendarBlank, CalendarDots, ChartBar, GearSix, Robot, Fire, Moon, X, CheckCircle, WarningCircle, Info, Sparkle,
  Target, Lightning, CircleNotch, Checks,
} from '@phosphor-icons/react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import { addDays, dayLabel, dueDate, fmtTime, greeting, relative, todayStr } from './utils/date.js';
import { useReminders } from './hooks/useReminders.js';
import { useFocus } from './hooks/useFocus.js';
import TaskForm from './components/TaskForm.jsx';
import TaskItem from './components/TaskItem.jsx';
import ReminderModal from './components/ReminderModal.jsx';
import AgentPanel from './components/AgentPanel.jsx';
import Insights from './components/Insights.jsx';
import SettingsView from './components/SettingsView.jsx';
import AuthView from './components/AuthView.jsx';
import CalendarView from './components/CalendarView.jsx';
import HabitsView from './components/HabitsView.jsx';
import FocusView, { FocusMini } from './components/FocusView.jsx';
import BriefingCard from './components/BriefingCard.jsx';
import NotifyPrompt from './components/NotifyPrompt.jsx';
import { vibrate, stopVibration } from './utils/haptics.js';
import { THEMES, applyTheme, currentTheme } from './utils/themes.js';

const NAV = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarBlank },
  { id: 'calendar', label: 'Calendar', icon: CalendarDots },
  { id: 'habits', label: 'Habits', icon: Checks },
  { id: 'focus', label: 'Focus', icon: Target },
  { id: 'insights', label: 'Insights', icon: ChartBar },
  { id: 'settings', label: 'Settings', icon: GearSix },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState(getToken() ? 'checking' : 'out');

  useEffect(() => {
    setUnauthorizedHandler(() => { setToken(null); setUser(null); setAuthState('out'); });
    if (!getToken()) return;
    api.me().then((u) => { setUser(u); setAuthState('in'); }).catch(() => { setToken(null); setAuthState('out'); });
  }, []);

  if (authState === 'checking') return <div className="splash"><CircleNotch size={32} className="spin" /></div>;
  if (authState === 'out') return <AuthView onAuthed={(u) => { setUser(u); setAuthState('in'); }} />;
  return <Dashboard user={user} onLogout={() => { setToken(null); setUser(null); setAuthState('out'); localStorage.removeItem('daymate-push'); }} />;
}

function Dashboard({ user, onLogout }) {
  const params = new URLSearchParams(window.location.search);
  const [view, setView] = useState(params.get('view') || 'today');
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [health, setHealth] = useState({});
  const [serverDown, setServerDown] = useState(false);
  const [agentOpen, setAgentOpen] = useState(() => Boolean(params.get('agent')) || localStorage.getItem('daymate-agent-on') === '1');
  const [kick, setKick] = useState(() => (params.get('agent') && params.get('agent') !== 'start' ? { mode: params.get('agent'), n: 1 } : null));
  const [toasts, setToasts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [now, setNow] = useState(new Date());
  const [reviewPrompt, setReviewPrompt] = useState(false);
  const [theme, setTheme] = useState(currentTheme);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNotify, setShowNotify] = useState(false);
  const [forceNotify, setForceNotify] = useState(false);
  const today = todayStr(now);
  const changeTheme = (id) => { applyTheme(id); setTheme(id); };

  useEffect(() => { if (params.toString()) window.history.replaceState({}, '', '/'); /* clean URL */ }, []); // eslint-disable-line

  const toast = useCallback((msg, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    const t = todayStr();
    try {
      const [ts, st] = await Promise.all([api.tasks({ from: addDays(t, -45), to: addDays(t, 120), today: t }), api.stats(t)]);
      setTasks(ts);
      setStats(st);
      setServerDown(false);
      setRefreshKey((k) => k + 1);
    } catch {
      setServerDown(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [s, h] = await Promise.all([api.settings(), api.health()]);
        setHealth(h);
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        let next = s;
        if (tz && s.timezone !== tz) next = await api.saveSettings({ timezone: tz });
        if (!next.name && user?.name) next = await api.saveSettings({ name: user.name });
        setSettings(next);
      } catch { setServerDown(true); }
      load();
    })();
  }, [load, user]);

  useEffect(() => {
    const a = setInterval(() => setNow(new Date()), 20000);
    const b = setInterval(load, 60000);
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(a); clearInterval(b); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  // messages from the service worker (notification buttons / clicks)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMsg = (e) => {
      if (e.data?.type === 'daymate-refresh') load();
      if (e.data?.type === 'daymate-open' && e.data.url) {
        const u = new URL(e.data.url, window.location.origin);
        if (u.searchParams.get('agent')) { setAgentOpen(true); setKick({ mode: u.searchParams.get('agent'), n: Date.now() }); }
        if (u.searchParams.get('view')) setView(u.searchParams.get('view'));
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [load]);

  useEffect(() => { const t = setTimeout(() => setShowNotify(true), 2500); return () => clearTimeout(t); }, []);

  useEffect(() => { localStorage.setItem('daymate-agent-on', agentOpen ? '1' : '0'); }, [agentOpen]);

  // ---- Task operations ----
  const refreshStats = useCallback(() => api.stats(todayStr()).then(setStats).catch(() => {}), []);

  const addTask = async (data) => {
    try {
      const t = await api.createTask(data);
      setTasks((ts) => [...ts, t]);
      toast(`Added: ${t.title}${t.time ? ` · ${fmtTime(t.time)}` : ''}${t.date !== todayStr() ? ` · ${dayLabel(t.date, todayStr())}` : ''}`);
      refreshStats();
    } catch (e) { toast(e.message, 'error'); throw e; }
  };

  const updateTask = useCallback(async (id, patch, { silent = false } = {}) => {
    if (patch.status === 'done' && !silent) vibrate('tap', settingsRef.current?.vibration);
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch, ...(patch.subtasks ? { subtasks: patch.subtasks.map((s, i) => ({ id: s.id || `tmp${i}`, ...s })) } : {}) } : t)));
    try {
      const t = await api.updateTask(id, patch);
      setTasks((ts) => ts.map((x) => (x.id === id ? t : x)));
      if (!silent) {
        if (patch.status === 'done') toast(`Shabash! "${t.title}" done`);
        else if (patch.date) toast(`Moved to ${dayLabel(t.date, todayStr())}`, 'info');
        if (patch.status === 'done' && t.repeat !== 'none') load();
        refreshStats();
      }
      return t;
    } catch (e) { toast(e.message, 'error'); load(); return null; }
  }, [toast, load, refreshStats]);

  const deleteTask = async (id) => {
    const t = tasks.find((x) => x.id === id);
    setTasks((ts) => ts.filter((x) => x.id !== id));
    try { await api.deleteTask(id); toast(`Deleted: ${t?.title || 'task'}`, 'info'); refreshStats(); } catch (e) { toast(e.message, 'error'); load(); }
  };

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const saveSettings = async (patch) => {
    const s = await api.saveSettings({ ...settings, ...patch });
    setSettings(s);
    return s;
  };

  // ---- Focus ----
  const focus = useFocus(settings, { onLogged: () => setRefreshKey((k) => k + 1), onToast: toast });
  const startFocus = (task) => { focus.start(task); toast(`Focus shuru: ${task.title}`, 'info'); };

  // ---- Reminders ----
  const onStage = useCallback((id, patch) => updateTask(id, patch, { silent: true }), [updateTask]);
  const { alerts, dismiss, test } = useReminders(tasks, { settings, onStage, onToast: toast });

  async function handleAlert(action, minutes) {
    const a = alerts[0];
    if (!a) return;
    dismiss(a.key);
    stopVibration();
    if (a.test) return;
    const { task } = a;
    if (action === 'done') await updateTask(task.id, { status: 'done' });
    else if (action === 'missed') await updateTask(task.id, { status: 'missed' });
    else if (action === 'tomorrow') await updateTask(task.id, { date: addDays(todayStr(), 1), status: 'pending' });
    else if (action === 'focus') { startFocus(task); setView('focus'); }
    else if (action === 'snooze') {
      try {
        const t = await api.snooze(task.id, minutes);
        setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)));
        toast(`Snoozed ${minutes} min`, 'info');
      } catch (e) { toast(e.message, 'error'); }
    }
  }

  // ---- Evening review prompt ----
  useEffect(() => {
    if (!settings || !stats) return;
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setReviewPrompt(hhmm >= settings.reviewTime && !stats.reviewDone && !localStorage.getItem(`daymate-review-prompt-${today}`));
  }, [now, settings, stats, today]);

  const openAgent = (mode) => { setAgentOpen(true); if (mode) setKick({ mode, n: Date.now() }); };
  const closeAgent = () => { setAgentOpen(false); setKick(null); };

  // ---- Derived ----
  const groups = useMemo(() => {
    const overdue = tasks.filter((t) => t.status === 'pending' && t.date < today);
    const todayAll = tasks.filter((t) => t.date === today);
    const pending = todayAll.filter((t) => t.status === 'pending');
    const finished = todayAll.filter((t) => t.status !== 'pending');
    const upcoming = Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i + 1); return { date: d, tasks: tasks.filter((t) => t.date === d) }; });
    const later = tasks.filter((t) => t.date > addDays(today, 7) && t.status === 'pending');
    return { overdue, pending, finished, todayAll, upcoming, later };
  }, [tasks, today]);

  const overloaded = groups.pending.length >= 8 || groups.overdue.length >= 3;
  const nextTask = groups.pending.find((t) => t.time && dueDate(t) >= now);
  const progress = groups.todayAll.length ? Math.round((groups.todayAll.filter((t) => t.status === 'done').length / groups.todayAll.length) * 100) : 0;
  const itemProps = { today, now, onUpdate: updateTask, onDelete: deleteTask, onEdit: setEditing, onFocus: startFocus };
  const title = NAV.find((n) => n.id === view)?.label;

  return (
    <div className={`app ${agentOpen ? 'with-agent' : ''}`}>
      <div className="bg-glow" />

      <nav className="sidebar">
        <div className="brand"><div className="logo"><Sparkle size={18} weight="fill" /></div><span>DayMate <b>AI</b></span></div>
        <div className="nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>
              <Icon size={20} weight={view === id ? 'fill' : 'duotone'} /> <span>{label}</span>
              {id === 'today' && groups.pending.length > 0 && <em className="badge">{groups.pending.length}</em>}
            </button>
          ))}
        </div>
        <div className="side-card">
          <div className="side-streak"><Fire size={18} weight="fill" /> <b>{stats?.streak ?? 0}</b> day streak</div>
          <div className="side-themes" aria-label="Theme">
            {THEMES.map((t) => (
              <button key={t.id} title={t.name} className={`dot-theme ${theme === t.id ? 'on' : ''}`} style={{ background: `linear-gradient(135deg, ${t.swatch[1]}, ${t.swatch[2]})`, '--ring': t.swatch[1] }} onClick={() => changeTheme(t.id)} />
            ))}
          </div>
          <button className={`agent-switch ${agentOpen ? 'on' : ''}`} onClick={() => (agentOpen ? closeAgent() : openAgent())}>
            <Robot size={19} weight="fill" /><span>AI Agent</span><i className="switch"><i /></i>
          </button>
        </div>
      </nav>

      <main className="main">
        {serverDown && <div className="banner error"><WarningCircle size={19} /> Server se connect nahi ho pa raha. <code>npm run dev</code> chalayein.</div>}

        {view === 'today' ? (
          <header className="hero-card">
            <div className="hero-top">
              <div className="hero-text">
                <div className="hero-date">
                  <span>{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span><i />
                  <span className="mono">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <h1>{greeting(now)}{settings?.name ? <>, <em>{settings.name}</em></> : ''}</h1>
                <p className="hero-sub">
                  {groups.todayAll.length === 0 ? 'Aaj ke liye abhi koi task nahi. Neeche add karein ya agent se planning karein.'
                    : nextTask ? <>Next up · <b>{nextTask.title}</b> at {fmtTime(nextTask.time)} <span className="hero-rel">{relative(dueDate(nextTask), now)}</span></>
                      : groups.pending.length ? `${groups.pending.length} kaam baqi hain — aap kar sakte hain.` : 'Aaj ke saare kaam complete. Shabash!'}
                </p>
              </div>
              <div className="ring" style={{ '--p': progress }}><div><b>{progress}<small>%</small></b><span>today</span></div></div>
            </div>
            <div className="hero-stats">
              <div className="hstat"><span>Completed</span><b>{groups.todayAll.filter((t) => t.status === 'done').length}</b></div>
              <div className="hstat"><span>Pending</span><b>{groups.pending.length}</b></div>
              <div className="hstat"><span>Overdue</span><b className={groups.overdue.length ? 'warn' : ''}>{groups.overdue.length}</b></div>
              <div className="hstat"><span>Streak</span><b>{stats?.streak ?? 0}<small> days</small></b></div>
            </div>
          </header>
        ) : (
          <header className="page-head"><h1>{title}</h1></header>
        )}

        {reviewPrompt && (
          <div className="banner review">
            <Moon size={20} weight="fill" />
            <div><b>Daily review ka time!</b> Batayein aaj kya kiya aur kal ke liye kya plan hai.</div>
            <button className="btn primary sm" onClick={() => { openAgent('review'); localStorage.setItem(`daymate-review-prompt-${today}`, '1'); setReviewPrompt(false); }}>Start review</button>
            <button className="icon-btn" onClick={() => { localStorage.setItem(`daymate-review-prompt-${today}`, '1'); setReviewPrompt(false); }}><X size={16} /></button>
          </div>
        )}

        {view === 'today' && (
          <>
            <BriefingCard today={today} settings={settings} refreshKey={refreshKey} />
            {overloaded && (
              <div className="banner warn-banner">
                <Lightning size={20} weight="fill" />
                <div><b>Aaj ka din overload lag raha hai.</b> {groups.pending.length} pending, {groups.overdue.length} overdue. Agent se realistic plan banwayein.</div>
                <button className="btn primary sm" onClick={() => openAgent('optimize')}>Smart reschedule</button>
              </div>
            )}
            <TaskForm today={today} defaultDate={today} onSubmit={addTask} />
            {groups.overdue.length > 0 && (
              <Section title="Overdue" tone="danger" count={groups.overdue.length}>
                {groups.overdue.map((t) => (
                  <div key={t.id} className="overdue-wrap"><span className="overdue-day">{dayLabel(t.date, today)}</span><TaskItem task={t} {...itemProps} /></div>
                ))}
              </Section>
            )}
            <Section title="Today's plan" count={groups.pending.length}>
              {groups.pending.length === 0 && <div className="empty">{groups.todayAll.length ? 'Sab kuch ho gaya!' : 'Koi pending task nahi.'}</div>}
              <div className="timeline">{groups.pending.map((t) => <TaskItem key={t.id} task={t} {...itemProps} />)}</div>
            </Section>
            {groups.finished.length > 0 && (
              <Section title="Completed" count={groups.finished.length} collapsible>
                {groups.finished.map((t) => <TaskItem key={t.id} task={t} {...itemProps} />)}
              </Section>
            )}
          </>
        )}

        {view === 'upcoming' && (
          <>
            <TaskForm today={today} defaultDate={addDays(today, 1)} onSubmit={addTask} />
            <div className="plan-cta"><Robot size={19} /> Agent se kal ki planning karwayein<button className="btn primary sm" onClick={() => openAgent('plan')}>Plan tomorrow</button></div>
            {groups.upcoming.map((g) => (
              <Section key={g.date} title={dayLabel(g.date, today)} count={g.tasks.length}>
                {g.tasks.length === 0 ? <div className="empty small">Free day</div> : g.tasks.map((t) => <TaskItem key={t.id} task={t} {...itemProps} />)}
              </Section>
            ))}
            {groups.later.length > 0 && (
              <Section title="Later" count={groups.later.length}>
                {groups.later.map((t) => <div key={t.id} className="overdue-wrap"><span className="overdue-day">{dayLabel(t.date, today)}</span><TaskItem task={t} {...itemProps} /></div>)}
              </Section>
            )}
          </>
        )}

        {view === 'calendar' && <CalendarView tasks={tasks} today={today} itemProps={itemProps} onAdd={addTask} onMove={(id, date) => updateTask(id, { date, status: 'pending' })} />}
        {view === 'habits' && <HabitsView today={today} toast={toast} refreshKey={refreshKey} />}
        {view === 'focus' && <FocusView focus={focus} tasks={tasks} today={today} refreshKey={refreshKey} />}
        {view === 'insights' && <Insights stats={stats} today={today} toast={toast} />}
        {view === 'settings' && (
          <SettingsView
            settings={settings} health={health} theme={theme} onTheme={changeTheme} onSave={saveSettings} user={user} onLogout={onLogout} toast={toast}
            onNotifyAccess={() => { setForceNotify(true); setShowNotify(true); }}
            onTestReminder={() => test({ id: 'test', title: 'Test reminder', time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, date: today, category: 'other' })}
          />
        )}
      </main>

      <AgentPanel open={agentOpen} onClose={closeAgent} kick={kick} today={today} settings={settings} aiOnline={health.ai} aiLabel={health.aiProviders?.[0] ? `${health.aiProviders[0].label}${health.aiProviders.length > 1 ? ` + ${health.aiProviders.length - 1} backup` : ''}` : ''} onChanged={load} onSettings={saveSettings} />

      {view !== 'focus' && <FocusMini focus={focus} onOpen={() => setView('focus')} />}

      {!agentOpen && (
        <button className="fab" onClick={() => openAgent()} title="AI Agent ON karein"><Robot size={24} weight="fill" /><span>Agent</span></button>
      )}

      <nav className="bottom-nav">
        {NAV.filter((n) => n.id !== 'upcoming').map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
            <Icon size={21} weight={view === id ? 'fill' : 'duotone'} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {editing && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal">
            <h3>Edit task</h3>
            <TaskForm
              today={today} initial={editing} compact={false} onCancel={() => setEditing(null)}
              onSubmit={async (data) => {
                const { title, notes, date, time, priority, category, remindBefore, repeat, subtasks } = data;
                await updateTask(editing.id, { title, notes, date, time, priority, category, remindBefore, repeat, subtasks });
                setEditing(null);
              }}
            />
          </div>
        </div>
      )}

      {showNotify && settings && <NotifyPrompt key={forceNotify ? 'f' : 'n'} settings={settings} toast={toast} force={forceNotify} onDone={() => { setShowNotify(false); setForceNotify(false); }} />}

      <ReminderModal alert={alerts[0]} count={alerts.length} onAction={handleAlert} />

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'error' ? <WarningCircle size={17} weight="fill" /> : t.type === 'info' ? <Info size={17} weight="fill" /> : <CheckCircle size={17} weight="fill" />}
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, count, tone, collapsible, children }) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <section className={`section ${tone || ''}`}>
      <button className="section-head" onClick={() => collapsible && setOpen(!open)}>
        <h2>{title}</h2>
        {count > 0 && <span className="count">{count}</span>}
        {collapsible && <span className="muted small">{open ? 'Hide' : 'Show'}</span>}
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}
