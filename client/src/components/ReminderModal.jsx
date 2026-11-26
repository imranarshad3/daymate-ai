import { BellRinging, Check, Clock, ArrowCircleRight, X, Question, Play } from '@phosphor-icons/react';
import { catOf } from '../utils/constants.js';
import { fmtTime } from '../utils/date.js';

export default function ReminderModal({ alert, count, onAction }) {
  if (!alert) return null;
  const { task, kind } = alert;
  const cat = catOf(task.category);
  const followup = kind === 'followup';

  return (
    <div className="overlay">
      <div className={`reminder ${followup ? 'followup' : ''}`} role="alertdialog" aria-labelledby="rem-title">
        <div className="rem-icon">{followup ? <Question size={36} weight="fill" /> : <BellRinging size={36} weight="fill" />}</div>
        <div className="rem-kicker">{followup ? 'Follow-up' : "Time's up"} {count > 1 && <span>· {count - 1} more</span>}</div>
        <h2 id="rem-title">{followup ? 'Kya aap ne yeh kar liya?' : task.title}</h2>
        {followup && <div className="rem-task">{task.title}</div>}
        <div className="rem-meta">
          <span><Clock size={15} /> {fmtTime(task.time)}</span>
          <span><cat.Icon size={15} color={cat.color} /> {cat.label}</span>
        </div>
        {task.notes && <p className="rem-notes">{task.notes}</p>}

        <div className="rem-actions">
          <button className="btn primary big" onClick={() => onAction('done')}>
            <Check size={18} weight="bold" /> {followup ? 'Haan, kar liya' : 'Done'}
          </button>
          {!followup && !alert.test && (
            <button className="btn ghost" onClick={() => onAction('focus')}><Play size={16} weight="fill" /> Focus timer ke saath shuru karein</button>
          )}
          <div className="rem-snooze">
            <span>Snooze</span>
            {[5, 10, 15, 30].map((m) => (
              <button key={m} className="chip" onClick={() => onAction('snooze', m)}>{m}m</button>
            ))}
          </div>
          <div className="rem-row">
            <button className="btn ghost" onClick={() => onAction('tomorrow')}><ArrowCircleRight size={17} /> Kal pe shift</button>
            <button className="btn ghost danger" onClick={() => onAction('missed')}><X size={17} /> Nahi kiya</button>
          </div>
          <button className="link" onClick={() => onAction('dismiss')}>Baad mein dekhta hoon</button>
        </div>
      </div>
    </div>
  );
}
