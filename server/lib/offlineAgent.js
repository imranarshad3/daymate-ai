// Basic rule-based agent used when no AI key (Gemini / Groq / Anthropic) is configured.
import { getDb } from './db.js';
import { addDays } from './dates.js';
import { createTask, updateTask } from './tasks.js';
import { parseNatural } from './nlp.js';
import { habitSummary, setHabit } from './extras.js';

function rescheduleCandidates(today) {
  const db = getDb();
  const rank = { high: 0, medium: 1, low: 2 };
  const overdue = db.tasks.filter((t) => t.status === 'pending' && t.date < today);
  const todayP = db.tasks.filter((t) => t.status === 'pending' && t.date === today).sort((a, b) => rank[a.priority] - rank[b.priority]);
  const extra = todayP.slice(5).filter((t) => t.priority !== 'high');
  return [...overdue.filter((t) => t.priority !== 'high'), ...extra];
}

const fmt = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const line = (t) => `- ${t.title}${t.time ? ` — ${fmt(t.time)}` : ''}`;
const DONE_WORDS = /\b(kar liya|kr liya|kar li|kr li|ho gaya|ho gya|hogaya|hogya|done|complete|completed|finish|finished|mukammal)\b/i;
const NOTICE = '\n\n(Offline mode — poori AI ke liye server/.env mein GEMINI_API_KEY ya GROQ_API_KEY add karein.)';

function snapshot(today, settings) {
  const ts = getDb().tasks.filter((t) => t.date === today);
  const done = ts.filter((t) => t.status === 'done');
  const pending = ts.filter((t) => t.status === 'pending');
  const hi = settings.name ? `Assalam o Alaikum ${settings.name}! 👋` : 'Assalam o Alaikum! 👋';
  let s = `${hi}\nAaj: ✅ ${done.length} done, ⏳ ${pending.length} pending.`;
  if (pending.length) s += `\n\nPending:\n${pending.map(line).join('\n')}`;
  return s;
}

export function offlineReply({ messages, kickoff, now, settings }) {
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const db = getDb();
  const actions = [];

  if (kickoff === 'start') {
    return { reply: `${snapshot(today, settings)}\n\nBatayein — aaj ka review karein ya kal ki planning? Aap seedha likh bhi sakte hain: "kal 10:30 Ali ko call".${NOTICE}`, actions, mode: 'offline' };
  }
  if (kickoff === 'review') {
    const pending = db.tasks.filter((t) => t.date === today && t.status === 'pending');
    const body = pending.length
      ? `Aaj ke pending kaam:\n${pending.map(line).join('\n')}\n\nJo kar liya uska naam likh kar "kar liya" likhein, e.g. "${pending[0].title} kar liya".`
      : 'Aaj ke saare tasks complete hain! 🎉 Kal ke liye kya plan hai?';
    return { reply: `📝 Daily review\n${body}`, actions, mode: 'offline' };
  }
  if (kickoff === 'plan') {
    const tm = db.tasks.filter((t) => t.date === tomorrow);
    const body = tm.length ? `Kal ke liye already:\n${tm.map(line).join('\n')}\n\n` : '';
    return { reply: `📅 Kal ki planning\n${body}Kal kya kya karna hai? Har kaam nayi line mein time ke saath likhein:\n"10:30 Ali ko call"\n"shaam 5 baje gym"`, actions, mode: 'offline' };
  }

  if (kickoff === 'optimize') {
    const c = rescheduleCandidates(today);
    if (!c.length) return { reply: 'Aaj ka plan theek lag raha hai 👍 Koi cheez shift karne ki zaroorat nahi.', actions, mode: 'offline' };
    return { reply: `🧠 Smart reschedule\nYeh kaam kal (${tomorrow}) pe shift kar doon?\n${c.map(line).join('\n')}\n\n"haan" likhein to apply kar doonga.`, actions, mode: 'offline' };
  }

  const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user');
  const text = String(lastUser?.content || '').trim();
  if (!text) return { reply: snapshot(today, settings), actions, mode: 'offline' };

  const prevAssistant = [...(messages || [])].reverse().find((m) => m.role === 'assistant')?.content || '';
  if (/Smart reschedule/.test(prevAssistant) && /^(haan|han|ha|yes|ok|okay|theek|thik|kar do|apply)\b/i.test(text)) {
    const c = rescheduleCandidates(today);
    for (const t of c) {
      updateTask(t.id, { date: tomorrow, status: 'pending' });
      actions.push({ type: 'moved', title: t.title, date: tomorrow, time: t.time });
    }
    return { reply: `✅ ${c.length} kaam kal pe shift kar diye. Ab aaj ka din halka hai!`, actions, mode: 'offline' };
  }

  // 1) Marking things done
  if (DONE_WORDS.test(text)) {
    const lowerH = text.toLowerCase();
    const habits = habitSummary(today).filter((h) => lowerH.includes(h.name.toLowerCase().split(' ')[0]));
    for (const h of habits) {
      setHabit(h.id, today, true);
      actions.push({ type: 'habit', title: h.name });
    }
    const lower = text.toLowerCase();
    const matched = db.tasks.filter((t) => {
      if (t.status !== 'pending' || t.date > today) return false;
      const words = t.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      return words.some((w) => lower.includes(w));
    });
    for (const t of matched) {
      updateTask(t.id, { status: 'done' });
      actions.push({ type: 'done', title: t.title, date: t.date, time: t.time });
    }
    const last = db.integrations.lastReminderTaskId && db.tasks.find((t) => t.id === db.integrations.lastReminderTaskId && t.status === 'pending');
    if (!matched.length && !habits.length && last) {
      updateTask(last.id, { status: 'done' });
      matched.push(last);
      actions.push({ type: 'done', title: last.title, date: last.date, time: last.time });
    }
    if (matched.length || habits.length) {
      return { reply: `Zabardast! 🎉 Done mark kar diya:\n${[...matched.map(line), ...habits.map((h) => `- ${h.name} (habit)`)].join('\n')}`, actions, mode: 'offline' };
    }
  }

  // 2) Adding tasks (one per line / comma / semicolon)
  const parts = text.split(/\n|;|,/).map((p) => p.trim()).filter(Boolean);
  const lastAssistant = [...(messages || [])].reverse().find((m) => m.role === 'assistant')?.content || '';
  const planning = /kal ki planning|kal kya kya/i.test(lastAssistant);
  const created = [];
  for (const p of parts) {
    const parsed = parseNatural(p, today);
    const looksLikeTask = parsed.time || parsed.date || planning;
    if (!looksLikeTask || parsed.title.length < 2) continue;
    const t = createTask({ title: parsed.title, date: parsed.date || (planning ? tomorrow : today), time: parsed.time, category: parsed.category || 'personal' }, 'agent');
    created.push(t);
    actions.push({ type: 'added', title: t.title, date: t.date, time: t.time });
  }
  if (created.length) {
    const label = (d) => (d === today ? 'Aaj' : d === tomorrow ? 'Kal' : d);
    return {
      reply: `✅ Add kar diya:\n${created.map((t) => `${line(t)} (${label(t.date)})`).join('\n')}\n\nWaqt par main remind karwa doonga. Aur kuch?`,
      actions,
      mode: 'offline',
    };
  }

  return {
    reply: `Main yeh kar sakta hoon:\n- Task add: "kal 10:30 Ali ko call"\n- Done mark: "gym kar liya"\n- Neeche buttons se Review / Planning${NOTICE}`,
    actions,
    mode: 'offline',
  };
}
