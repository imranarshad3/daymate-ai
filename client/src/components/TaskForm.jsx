import { useEffect, useRef, useState } from 'react';
import { Plus, Sparkle as Sparkles, Clock, CalendarBlank as CalendarDays, Bell, Repeat, Flag, Tag, CaretDown as ChevronDown, ListChecks, X } from '@phosphor-icons/react';
import { CATEGORIES, PRIORITIES, REMIND_OPTIONS, REPEAT_OPTIONS } from '../utils/constants.js';
import { addDays, dueDate, fmtTime } from '../utils/date.js';
import { parseNatural } from '../utils/nlp.js';

const blank = (date) => ({
  title: '', notes: '', date, time: '', priority: 'medium', category: 'personal', remindBefore: 10, repeat: 'none', subtasks: [],
});

export default function TaskForm({ today, defaultDate, initial, onSubmit, onCancel, compact = true }) {
  const [f, setF] = useState(() => (initial ? { ...blank(today), ...initial } : blank(defaultDate || today)));
  const [open, setOpen] = useState(!compact || Boolean(initial));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!initial) setF((x) => ({ ...x, date: defaultDate || today }));
  }, [defaultDate, today, initial]);

  // Smart preview: "kal 10:30 Ali ko call" -> tomorrow, 10:30
  const hint = !initial && f.title ? parseNatural(f.title, today) : null;
  const showHint = hint && (hint.time || hint.date) && !f.time;

  async function submit(e) {
    e.preventDefault();
    if (!f.title.trim() || busy) return;
    let data = { ...f };
    if (!initial) {
      const p = parseNatural(f.title, today);
      if (!f.time && (p.time || p.date)) {
        data = { ...data, title: p.title, time: p.time || data.time, date: p.date || data.date };
      }
      if (f.category === 'personal' && p.category) data.category = p.category;
    }
    // If the time already passed, don't fire an instant alarm
    if (data.time && dueDate(data) < new Date() && (!initial || initial.time !== data.time || initial.date !== data.date)) {
      data.reminderStage = 3;
    }
    setBusy(true);
    try {
      await onSubmit(data);
      if (!initial) {
        setF(blank(defaultDate || today));
        inputRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`task-form ${open ? 'open' : ''}`} onSubmit={submit}>
      <div className="tf-row">
        <Sparkles size={20} weight="fill" className="tf-spark" />
        <input
          ref={inputRef}
          className="tf-title"
          placeholder='Kya karna hai? e.g. "kal 10:30 Ali ko call karni hai"'
          value={f.title}
          onChange={(e) => set('title', e.target.value)}
          onFocus={() => setOpen(true)}
          autoFocus={Boolean(initial)}
        />
        <button className="btn primary" disabled={!f.title.trim() || busy}>
          <Plus size={16} weight="bold" /> {initial ? 'Save' : 'Add'}
        </button>
      </div>

      {showHint && (
        <div className="tf-hint">
          ✨ Samajh gaya: <b>{hint.title}</b>
          {hint.date && <> · {hint.date === today ? 'Aaj' : hint.date === addDays(today, 1) ? 'Kal' : hint.date}</>}
          {hint.time && <> · {fmtTime(hint.time)}</>}
        </div>
      )}

      {open && (
        <div className="tf-grid">
          <label className="field">
            <span><CalendarDays size={14} /> Date</span>
            <div className="date-chips">
              <button type="button" className={`chip ${f.date === today ? 'on' : ''}`} onClick={() => set('date', today)}>Aaj</button>
              <button type="button" className={`chip ${f.date === addDays(today, 1) ? 'on' : ''}`} onClick={() => set('date', addDays(today, 1))}>Kal</button>
              <input type="date" value={f.date} onChange={(e) => e.target.value && set('date', e.target.value)} />
            </div>
          </label>
          <label className="field">
            <span><Clock size={14} /> Time</span>
            <input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />
          </label>
          <label className="field">
            <span><Bell size={14} /> Reminder</span>
            <Select value={f.remindBefore} onChange={(v) => set('remindBefore', Number(v))} options={REMIND_OPTIONS.map((o) => [o.v, o.label])} />
          </label>
          <label className="field">
            <span><Tag size={14} /> Category</span>
            <Select value={f.category} onChange={(v) => set('category', v)} options={CATEGORIES.map((c) => [c.id, c.label])} />
          </label>
          <label className="field">
            <span><Flag size={14} /> Priority</span>
            <div className="seg">
              {PRIORITIES.map((p) => (
                <button type="button" key={p.id} className={f.priority === p.id ? 'on' : ''} style={{ '--c': p.color }} onClick={() => set('priority', p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </label>
          <label className="field">
            <span><Repeat size={14} /> Repeat</span>
            <Select value={f.repeat} onChange={(v) => set('repeat', v)} options={REPEAT_OPTIONS.map((o) => [o.v, o.label])} />
          </label>
          <div className="field wide">
            <span><ListChecks size={14} /> Checklist</span>
            <SubtaskEditor items={f.subtasks || []} onChange={(v) => set('subtasks', v)} />
          </div>
          <label className="field wide">
            <span>Notes</span>
            <textarea rows={2} placeholder="Optional details (phone number, address...)" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
          {(onCancel || compact) && (
            <div className="tf-actions wide">
              <button type="button" className="btn ghost" onClick={() => (onCancel ? onCancel() : setOpen(false))}>
                {onCancel ? 'Cancel' : 'Collapse'}
              </button>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

function Select({ value, onChange, options }) {
  return (
    <div className="select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <ChevronDown size={14} />
    </div>
  );
}

function SubtaskEditor({ items, onChange }) {
  const [text, setText] = useState('');
  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { text: t, done: false }]);
    setText('');
  };
  return (
    <div className="sub-editor">
      {items.map((s, i) => (
        <div key={s.id || i} className="sub-edit-row">
          <span className="sub-dot" />
          <input value={s.text} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          <button type="button" className="icon-btn" onClick={() => onChange(items.filter((_, j) => j !== i))}><X size={14} /></button>
        </div>
      ))}
      <div className="sub-edit-row add">
        <Plus size={14} />
        <input
          value={text}
          placeholder="Step add karein, Enter dabayein"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
      </div>
    </div>
  );
}
