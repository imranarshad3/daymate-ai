import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight, Plus } from '@phosphor-icons/react';
import { catOf } from '../utils/constants.js';
import { addDays, dayLabel, fmtTime, todayStr } from '../utils/date.js';
import TaskItem from './TaskItem.jsx';
import TaskForm from './TaskForm.jsx';

const pad = (n) => String(n).padStart(2, '0');

export default function CalendarView({ tasks, today, itemProps, onAdd, onMove }) {
  const [cursor, setCursor] = useState(() => today.slice(0, 7)); // YYYY-MM
  const [selected, setSelected] = useState(today);
  const [dragId, setDragId] = useState(null);
  const [overDay, setOverDay] = useState(null);

  const days = useMemo(() => {
    const [y, m] = cursor.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday first
    const start = addDays(`${y}-${pad(m)}-01`, -startOffset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const byDate = useMemo(() => {
    const map = {};
    for (const t of tasks) (map[t.date] = map[t.date] || []).push(t);
    return map;
  }, [tasks]);

  const shift = (n) => {
    const [y, m] = cursor.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setCursor(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const monthLabel = new Date(`${cursor}-01T00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selTasks = byDate[selected] || [];

  return (
    <div className="calendar-page">
      <div className="cal-head">
        <h2>{monthLabel}</h2>
        <div className="row">
          <button className="btn ghost sm" onClick={() => { setCursor(today.slice(0, 7)); setSelected(today); }}>Today</button>
          <button className="icon-btn" onClick={() => shift(-1)}><CaretLeft size={18} weight="bold" /></button>
          <button className="icon-btn" onClick={() => shift(1)}><CaretRight size={18} weight="bold" /></button>
        </div>
      </div>
      <p className="muted small cal-hint">Tip: task ko drag karke doosre din par chhod dein.</p>

      <div className="cal-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {days.map((d) => {
          const list = byDate[d] || [];
          const inMonth = d.slice(0, 7) === cursor;
          const doneN = list.filter((t) => t.status === 'done').length;
          return (
            <div
              key={d}
              className={`cal-day ${inMonth ? '' : 'out'} ${d === today ? 'today' : ''} ${d === selected ? 'sel' : ''} ${overDay === d ? 'over' : ''} ${d < todayStr() ? 'past' : ''}`}
              onClick={() => setSelected(d)}
              onDragOver={(e) => { e.preventDefault(); setOverDay(d); }}
              onDragLeave={() => setOverDay((x) => (x === d ? null : x))}
              onDrop={(e) => { e.preventDefault(); setOverDay(null); if (dragId) onMove(dragId, d); setDragId(null); }}
            >
              <div className="cal-num">
                <span>{Number(d.slice(8))}</span>
                {list.length > 0 && <em>{doneN}/{list.length}</em>}
              </div>
              <div className="cal-items">
                {list.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className={`cal-chip ${t.status}`}
                    style={{ '--c': catOf(t.category).color }}
                    draggable
                    onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => setDragId(null)}
                    title={t.title}
                  >
                    {t.time && <b>{t.time}</b>} {t.title}
                  </div>
                ))}
                {list.length > 3 && <div className="cal-more">+{list.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>

      <section className="section">
        <div className="section-head"><h2>{dayLabel(selected, today)}</h2>{selTasks.length > 0 && <span className="count">{selTasks.length}</span>}</div>
        <TaskForm today={today} defaultDate={selected} onSubmit={onAdd} />
        <div className="section-body">
          {selTasks.length === 0 ? <div className="empty small"><Plus size={14} /> Is din koi task nahi</div>
            : [...selTasks].sort((a, b) => (a.time || '99').localeCompare(b.time || '99')).map((t) => <TaskItem key={t.id} task={t} {...itemProps} />)}
        </div>
      </section>
      <span className="sr-only">{fmtTime('00:00')}</span>
    </div>
  );
}
