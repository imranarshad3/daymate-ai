import { useState } from 'react';
import {
  Check, Clock, Repeat, Trash, ArrowCircleRight, PencilSimple, Robot, Bell, X, ArrowCounterClockwise,
  Play, ListChecks, CaretDown, CalendarBlank, Plus,
} from '@phosphor-icons/react';
import { catOf } from '../utils/constants.js';
import { addDays, dueDate, fmtTime, relative } from '../utils/date.js';

export default function TaskItem({ task, today, now, onUpdate, onDelete, onEdit, onFocus }) {
  const [open, setOpen] = useState(false);
  const [newSub, setNewSub] = useState('');
  const cat = catOf(task.category);
  const due = dueDate(task);
  const late = task.status === 'pending' && task.time && due < now;
  const done = task.status === 'done';
  const missed = task.status === 'missed';
  const subs = task.subtasks || [];
  const subDone = subs.filter((s) => s.done).length;

  const toggleSub = (id) => {
    const next = subs.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
    const allDone = next.length && next.every((s) => s.done);
    onUpdate(task.id, { subtasks: next, ...(allDone && !done ? { status: 'done' } : {}) });
  };
  const addSub = () => {
    if (!newSub.trim()) return;
    onUpdate(task.id, { subtasks: [...subs, { text: newSub.trim(), done: false }] }, { silent: true });
    setNewSub('');
  };

  return (
    <div className={`task ${task.status} ${late ? 'late' : ''} prio-${task.priority}`} style={{ '--cat': cat.color }}>
      <button className="check" aria-label={done ? 'Mark as pending' : 'Mark as done'} onClick={() => onUpdate(task.id, { status: done ? 'pending' : 'done' })}>
        {done && <Check size={13} weight="bold" />}
        {missed && <X size={13} weight="bold" />}
      </button>

      <div className="task-body">
        <div className="task-title" onDoubleClick={() => onEdit(task)}>{task.title}</div>
        <div className="task-meta">
          {task.time && (
            <span className={`pill time ${late ? 'danger' : ''}`}>
              <Clock size={13} /> {fmtTime(task.time)}
              {task.status === 'pending' && task.date === today && <em>· {relative(due, now)}</em>}
            </span>
          )}
          <span className="pill cat"><cat.Icon size={13} color={cat.color} /> {cat.label}</span>
          {task.priority === 'high' && <span className="pill high">High</span>}
          {subs.length > 0 && (
            <button className="pill subs" onClick={() => setOpen(!open)}>
              <ListChecks size={13} /> {subDone}/{subs.length}
              <CaretDown size={11} weight="bold" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
            </button>
          )}
          {task.repeat !== 'none' && <span className="pill"><Repeat size={13} /> {task.repeat}</span>}
          {task.time && task.remindBefore > 0 && task.status === 'pending' && <span className="pill subtle"><Bell size={13} /> {task.remindBefore}m</span>}
          {task.source === 'agent' && <span className="pill agent"><Robot size={13} /> AI</span>}
          {task.source === 'calendar' && <span className="pill agent"><CalendarBlank size={13} /> Calendar</span>}
          {missed && <span className="pill danger">Not done</span>}
        </div>
        {subs.length > 0 && (
          <div className="sub-progress"><i style={{ width: `${(subDone / subs.length) * 100}%` }} /></div>
        )}
        {open && (
          <div className="subtasks">
            {subs.map((s) => (
              <label key={s.id} className={`subtask ${s.done ? 'done' : ''}`}>
                <input type="checkbox" checked={s.done} onChange={() => toggleSub(s.id)} />
                <span className="sub-check">{s.done && <Check size={10} weight="bold" />}</span>
                <span>{s.text}</span>
              </label>
            ))}
            <div className="subtask add">
              <Plus size={13} />
              <input value={newSub} placeholder="Naya step…" onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} />
            </div>
          </div>
        )}
        {task.notes && <div className="task-notes">{task.notes}</div>}
      </div>

      <div className="task-actions">
        {task.status === 'pending' && onFocus && (
          <button className="icon-btn accent" title="Focus timer start karein" onClick={() => onFocus(task)}>
            <Play size={16} weight="fill" />
          </button>
        )}
        {subs.length === 0 && task.status === 'pending' && (
          <button className="icon-btn" title="Checklist add karein" onClick={() => setOpen(!open) || setNewSub('')}>
            <ListChecks size={17} />
          </button>
        )}
        {task.status !== 'pending' && (
          <button className="icon-btn" title="Pending pe wapas" onClick={() => onUpdate(task.id, { status: 'pending' })}>
            <ArrowCounterClockwise size={17} />
          </button>
        )}
        {task.status !== 'done' && (
          <button className="icon-btn" title="Kal pe shift karo" onClick={() => onUpdate(task.id, { date: addDays(task.date < today ? today : task.date, 1), status: 'pending' })}>
            <ArrowCircleRight size={17} />
          </button>
        )}
        <button className="icon-btn" title="Edit" onClick={() => onEdit(task)}><PencilSimple size={17} /></button>
        <button className="icon-btn danger" title="Delete" onClick={() => onDelete(task.id)}><Trash size={17} /></button>
      </div>
    </div>
  );
}
