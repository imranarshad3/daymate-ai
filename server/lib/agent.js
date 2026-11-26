import { getDb } from './db.js';
import { nowIn, addDays, weekdayName } from './dates.js';
import { createTask, updateTask, deleteTask, listTasks, saveReview, listReviews, findTask } from './tasks.js';
import { createHabit, findHabit, setHabit, habitSummary, addMemory, deleteMemory, behaviourPatterns } from './extras.js';
import { runAgent, aiEnabled } from './ai.js';
import { offlineReply } from './offlineAgent.js';

const TOOLS = [
  {
    name: 'add_task',
    description: 'Create a new todo / reminder. Call once per task.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short clear title, e.g. "Call Ali"' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: '24h HH:mm. Omit if no specific time.' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        category: { type: 'string', description: 'work, personal, call, health, study, shopping, family, finance, other' },
        notes: { type: 'string' },
        remindBefore: { type: 'number', description: 'Minutes before to give a heads-up. Default 10.' },
        repeat: { type: 'string', enum: ['none', 'daily', 'weekdays', 'weekly', 'monthly'] },
        subtasks: { type: 'array', items: { type: 'string' }, description: 'Optional checklist steps' },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'set_subtasks',
    description: "Replace a task's checklist (subtasks). Keep existing items you don't want to change, with their done state.",
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        subtasks: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, done: { type: 'boolean' } }, required: ['text'] } },
      },
      required: ['task_id', 'subtasks'],
    },
  },
  {
    name: 'set_task_status',
    description: 'Mark a task as done, missed (not done), or pending again.',
    input_schema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, status: { type: 'string', enum: ['done', 'missed', 'pending'] } },
      required: ['task_id', 'status'],
    },
  },
  {
    name: 'reschedule_task',
    description: 'Move a task to another date and/or time. Sets it back to pending.',
    input_schema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: '24h HH:mm, or "" for no time' } },
      required: ['task_id', 'date'],
    },
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task. Only when the user clearly asks.',
    input_schema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] },
  },
  {
    name: 'list_tasks',
    description: 'List tasks between two dates (inclusive).',
    input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
  },
  {
    name: 'save_daily_review',
    description: 'Save the end-of-day review once you know what the user did and did not do.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string' },
        accomplished: { type: 'array', items: { type: 'string' } },
        not_done: { type: 'array', items: { type: 'string' } },
        mood: { type: 'string', description: 'great, good, okay, tired, stressed' },
        notes: { type: 'string' },
        tomorrow_focus: { type: 'string' },
      },
      required: ['date', 'accomplished'],
    },
  },
  {
    name: 'check_habit',
    description: 'Mark a habit as done (or not done) for a date. Use habit id or name.',
    input_schema: {
      type: 'object',
      properties: { habit: { type: 'string' }, date: { type: 'string' }, done: { type: 'boolean' } },
      required: ['habit', 'date'],
    },
  },
  {
    name: 'create_habit',
    description: 'Create a new daily habit to track (e.g. "Namaz", "Drink 8 glasses water", "Gym").',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        days: { type: 'array', items: { type: 'number' }, description: 'Weekdays 0=Sun..6=Sat. Default every day.' },
        icon: { type: 'string', description: 'one of: sparkle, drop, barbell, book, moon, sun, heart, leaf, brain, pray, run, code, money, phone' },
      },
      required: ['name'],
    },
  },
  {
    name: 'remember',
    description: 'Save a durable fact/preference about the user for future planning (e.g. "goes to gym in the evening", "office 9-5 weekdays"). Only stable facts the user stated.',
    input_schema: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] },
  },
  {
    name: 'forget_memory',
    description: 'Delete a saved memory note by id when the user asks to forget it or it is outdated.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
];

const compact = (t) => ({
  id: t.id, title: t.title, date: t.date, time: t.time || null, status: t.status, priority: t.priority, category: t.category,
  ...(t.repeat !== 'none' ? { repeat: t.repeat } : {}),
  ...(t.subtasks?.length ? { subtasks: `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` } : {}),
});

function systemPrompt(now, settings, channel) {
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const db = getDb();
  const tasks = db.tasks;
  const todayT = tasks.filter((t) => t.date === today).map(compact);
  const tomorrowT = tasks.filter((t) => t.date === tomorrow).map(compact);
  const overdue = tasks.filter((t) => t.date < today && t.status === 'pending').map(compact).slice(0, 20);
  const habits = habitSummary(today).map((h) => ({ id: h.id, name: h.name, doneToday: h.doneToday, scheduledToday: h.scheduledToday, streak: h.streak }));
  const lastReview = listReviews(1)[0] || null;
  const lastReminded = db.integrations.lastReminderTaskId ? tasks.find((t) => t.id === db.integrations.lastReminderTaskId) : null;
  const pendingToday = todayT.filter((t) => t.status === 'pending').length;

  return `You are "DayMate", a warm, sharp personal productivity agent and daily accountability partner.

LANGUAGE & STYLE
- Reply in the user's language/style. Default: Roman Urdu mixed with English (e.g. "Aaj aap ne kya kya kiya?").
- Keep replies short: 2–6 lines. Use "- " bullets for lists. Light emojis are fine.${channel !== 'app' ? `\n- You are chatting over ${channel}. Plain text only, no markdown.` : ''}
- Encouraging but honest.

NOW: ${today} (${weekdayName(today)}) ${now.time}, timezone ${now.tz}. Tomorrow = ${tomorrow} (${weekdayName(tomorrow)}).
USER NAME: ${settings.name || 'unknown'}

JOBS
1) DAILY REVIEW: ask what they did today; go through pending tasks by name; set_task_status accordingly; ask before moving unfinished ones to tomorrow; also ask about today's habits and check_habit; then save_daily_review.
2) TOMORROW PLANNING: ask what to do tomorrow; add_task for EACH item (break big items into subtasks). Use what you know about the user (memory & patterns) to suggest good times.
   Time words: "subah 8"=08:00, "dopahar 2"=14:00, "shaam 5"=17:00, "raat 9"=21:00, "10:30"=10:30 (AM unless context says evening). "kal"=tomorrow, "parson"=day after.
3) SMART RESCHEDULE: if today is overloaded (${pendingToday} pending today, ${overdue.length} overdue) or the user asks, propose a realistic plan: keep high priority today, move low-priority/overdue items to lighter upcoming days. Propose first, apply with reschedule_task only after the user agrees.
4) MEMORY: when the user states a lasting fact or preference (schedule, routine, likes), call remember. Use memory to personalise suggestions.
5) Anytime: add / reschedule / complete / delete tasks, check habits.

RULES
- Always use tools for changes. Never claim a change without calling the tool.
- After changes, confirm briefly (title + time).
- If the user just says "done"/"ho gaya"/"kar liya" without naming a task, it refers to the last reminded task: ${lastReminded ? JSON.stringify(compact(lastReminded)) : 'none'}.
- Don't invent tasks.

DATA (JSON)
today: ${JSON.stringify(todayT)}
tomorrow: ${JSON.stringify(tomorrowT)}
overdue_pending: ${JSON.stringify(overdue)}
habits: ${JSON.stringify(habits)}
memory: ${JSON.stringify(db.memory.map((m) => ({ id: m.id, note: m.text })))}
patterns: ${JSON.stringify(behaviourPatterns(now.tz))}
last_review: ${JSON.stringify(lastReview ? { date: lastReview.date, tomorrowFocus: lastReview.tomorrowFocus, mood: lastReview.mood } : null)}`;
}

export const KICKOFFS = {
  start: '[The user switched the agent ON.] Greet them (by name if known) with a 2–3 line snapshot: done vs pending today, next timed task, habits left today. Ask what they want: daily review, plan tomorrow, or add something.',
  review: "[Daily review started.] Ask what they accomplished today. Mention today's pending tasks and today's unchecked habits by name (one message).",
  plan: "[Tomorrow planning started.] Show what's already scheduled for tomorrow (if any), then ask what else they need to do tomorrow and when.",
  optimize: '[Smart reschedule requested.] Look at today + overdue + the next 3 days. Propose a concrete, realistic rebalanced plan as a short list (what stays today, what moves where). Ask for confirmation before applying.',
};

function normalize(messages, kickoff) {
  const out = [];
  for (const m of messages || []) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = String(m.content ?? '').trim();
    if (!content) continue;
    if (!out.length && role === 'assistant') out.push({ role: 'user', content: '[Agent opened]' });
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n\n${content}`;
    else out.push({ role, content });
  }
  if (kickoff && KICKOFFS[kickoff]) {
    const last = out[out.length - 1];
    if (last && last.role === 'user') last.content += `\n\n${KICKOFFS[kickoff]}`;
    else out.push({ role: 'user', content: KICKOFFS[kickoff] });
  }
  return out.slice(-30);
}

function runTool(name, input, today) {
  switch (name) {
    case 'add_task': {
      const t = createTask(input, 'agent');
      return { result: { ok: true, task: compact(t) }, action: { type: 'added', title: t.title, date: t.date, time: t.time } };
    }
    case 'set_subtasks': {
      const t = updateTask(input.task_id, { subtasks: input.subtasks });
      return { result: { ok: true, task: compact(t) }, action: { type: 'subtasks', title: `${t.title} (${t.subtasks.length} steps)` } };
    }
    case 'set_task_status': {
      const t = updateTask(input.task_id, { status: input.status });
      return { result: { ok: true, task: compact(t) }, action: { type: input.status, title: t.title, date: t.date, time: t.time } };
    }
    case 'reschedule_task': {
      const patch = { date: input.date, status: 'pending' };
      if (typeof input.time === 'string') patch.time = input.time;
      const t = updateTask(input.task_id, patch);
      return { result: { ok: true, task: compact(t) }, action: { type: 'moved', title: t.title, date: t.date, time: t.time } };
    }
    case 'delete_task': {
      const t = deleteTask(input.task_id);
      return { result: { ok: true }, action: { type: 'deleted', title: t.title } };
    }
    case 'list_tasks':
      return { result: listTasks({ from: input.from, to: input.to }).map(compact) };
    case 'save_daily_review': {
      const r = saveReview(input);
      return { result: { ok: true }, action: { type: 'review', title: `Review saved for ${r.date}` } };
    }
    case 'check_habit': {
      const h = findHabit(input.habit);
      if (!h) throw new Error(`No habit matching "${input.habit}"`);
      const done = setHabit(h.id, input.date || today, input.done ?? true);
      return { result: { ok: true, habit: h.name, done }, action: { type: done ? 'habit' : 'habit-undo', title: h.name } };
    }
    case 'create_habit': {
      const h = createHabit(input);
      return { result: { ok: true, habit: { id: h.id, name: h.name } }, action: { type: 'habit-new', title: h.name } };
    }
    case 'remember': {
      const m = addMemory(input.note);
      return { result: { ok: true, id: m.id }, action: { type: 'memory', title: m.text } };
    }
    case 'forget_memory': {
      deleteMemory(input.id);
      return { result: { ok: true }, action: { type: 'forgot', title: 'Memory removed' } };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

export async function chat({ messages = [], kickoff, channel = 'app' } = {}) {
  const { settings } = getDb();
  const now = nowIn(settings.timezone);
  if (!aiEnabled()) return offlineReply({ messages, kickoff, now, settings });

  const msgs = normalize(messages, kickoff);
  if (!msgs.length) msgs.push({ role: 'user', content: KICKOFFS.start });
  const system = systemPrompt(now, settings, channel);
  const actions = [];
  const onTool = (name, input) => {
    try {
      const { result, action } = runTool(name, input || {}, now.date);
      if (action) actions.push(action);
      return JSON.stringify(result);
    } catch (e) {
      return `Error: ${e.message}`;
    }
  };
  let reply = '';
  let provider = null;
  try {
    ({ reply, provider } = await runAgent({ system, messages: msgs, tools: TOOLS, onTool }));
  } catch (e) {
    // All AI providers failed -> fall back to the offline agent so the app keeps working
    if (!actions.length) {
      const off = offlineReply({ messages, kickoff, now, settings });
      return { ...off, reply: `${off.reply}

(⚠️ AI abhi available nahi: ${e.message.slice(0, 120)})` };
    }
    reply = 'Kuch changes ho gaye, lekin AI ka jawab poora nahi aaya. Dobara try karein.';
  }
  return { reply: reply || 'Done ✅', actions, mode: 'ai', provider };
}

export { findTask };
