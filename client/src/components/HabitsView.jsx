import { useCallback, useEffect, useState } from 'react';
import { Plus, Check, Fire, Trash, X } from '@phosphor-icons/react';
import { api } from '../api.js';
import { HABIT_ICONS, habitIcon, WEEKDAYS } from '../utils/constants.js';

const SUGGESTIONS = [
  { name: 'Namaz', icon: 'pray' }, { name: '8 glass paani', icon: 'drop' }, { name: 'Gym / Exercise', icon: 'barbell' },
  { name: '20 min parhai', icon: 'book' }, { name: 'Jaldi sona', icon: 'moon' }, { name: 'Walk', icon: 'run' },
];

export default function HabitsView({ today, toast, refreshKey }) {
  const [habits, setHabits] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', icon: 'sparkle', days: [0, 1, 2, 3, 4, 5, 6] });

  const load = useCallback(() => api.habits(today).then(setHabits).catch((e) => toast(e.message, 'error')), [today, toast]);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function toggle(h, date) {
    const isToday = date === today;
    setHabits((hs) => hs.map((x) => (x.id === h.id ? { ...x, ...(isToday ? { doneToday: !x.doneToday } : {}), last7: x.last7.map((d) => (d.date === date ? { ...d, done: !d.done } : d)) } : x)));
    try {
      const r = await api.checkHabit(h.id, date);
      if (r.done && isToday) toast(`${h.name} ✓ · streak ${h.streak + 1}`, 'success');
      load();
    } catch (e) { toast(e.message, 'error'); load(); }
  }

  async function create(e) {
    e?.preventDefault();
    if (!form.name.trim()) return;
    try {
      await api.createHabit(form);
      setForm({ name: '', icon: 'sparkle', days: [0, 1, 2, 3, 4, 5, 6] });
      setAdding(false);
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(h) {
    if (!confirm(`"${h.name}" habit delete karein?`)) return;
    await api.deleteHabit(h.id).catch(() => {});
    load();
  }

  const todayList = habits.filter((h) => h.scheduledToday);
  const doneCount = todayList.filter((h) => h.doneToday).length;

  return (
    <div className="habits-page">
      <div className="habits-head">
        <div>
          <div className="eyebrow">Today</div>
          <div className="habits-score"><b>{doneCount}</b><span>/ {todayList.length} habits done</span></div>
        </div>
        <button className="btn primary" onClick={() => setAdding(!adding)}>{adding ? <X size={16} weight="bold" /> : <Plus size={16} weight="bold" />} {adding ? 'Cancel' : 'New habit'}</button>
      </div>

      {adding && (
        <form className="card habit-form" onSubmit={create}>
          <input className="habit-name" autoFocus placeholder="Habit ka naam, e.g. Namaz, Paani, Gym" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="icon-pick">
            {Object.entries(HABIT_ICONS).map(([k, Ic]) => (
              <button type="button" key={k} className={form.icon === k ? 'on' : ''} onClick={() => setForm({ ...form, icon: k })}><Ic size={20} /></button>
            ))}
          </div>
          <div className="day-pick">
            {WEEKDAYS.map((d, i) => (
              <button type="button" key={i} className={form.days.includes(i) ? 'on' : ''} onClick={() => setForm({ ...form, days: form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i] })}>{d}</button>
            ))}
          </div>
          <div className="row">
            <button className="btn primary">Save habit</button>
            <span className="muted small">Suggestions:</span>
            {SUGGESTIONS.map((s) => <button type="button" key={s.name} className="chip" onClick={() => setForm({ ...form, ...s })}>{s.name}</button>)}
          </div>
        </form>
      )}

      {habits.length === 0 && !adding && (
        <div className="empty">Abhi koi habit nahi. "New habit" se shuru karein — jaise Namaz, paani, ya exercise.</div>
      )}

      <div className="habit-list">
        {habits.map((h) => {
          const Ic = habitIcon(h.icon);
          return (
            <div key={h.id} className={`habit ${h.doneToday ? 'done' : ''} ${!h.scheduledToday ? 'off' : ''}`}>
              <button className="habit-check" disabled={!h.scheduledToday} onClick={() => toggle(h, today)} aria-label="Toggle today">
                {h.doneToday ? <Check size={22} weight="bold" /> : <Ic size={22} />}
              </button>
              <div className="habit-body">
                <div className="habit-title">{h.name}</div>
                <div className="habit-meta">
                  <span className={`streak ${h.streak ? 'hot' : ''}`}><Fire size={14} weight="fill" /> {h.streak} day streak</span>
                  <span className="muted">· {h.rate30}% (30d)</span>
                  {!h.scheduledToday && <span className="muted">· aaj off</span>}
                </div>
              </div>
              <div className="habit-week">
                {h.last7.map((d) => (
                  <button key={d.date} title={d.date} disabled={!d.scheduled} className={`hd ${d.done ? 'on' : ''} ${d.date === today ? 'today' : ''}`} onClick={() => toggle(h, d.date)}>
                    <span>{new Date(`${d.date}T00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                    <i>{d.done && <Check size={10} weight="bold" />}</i>
                  </button>
                ))}
              </div>
              <button className="icon-btn danger habit-del" onClick={() => remove(h)}><Trash size={16} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
