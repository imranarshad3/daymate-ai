import { randomUUID } from 'crypto';
import { getDb, persist } from './db.js';
import { addDays, nextOccurrence, zonedTimeToUtc } from './dates.js';

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['pending', 'done', 'missed'];
const REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'monthly'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function clean(input = {}, partial = false) {
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);

  if (!partial || has('title')) {
    const title = String(input.title ?? '').trim();
    if (!title) throw httpError(400, 'Title is required');
    out.title = title.slice(0, 200);
  }
  if (!partial || has('date')) {
    if (!DATE_RE.test(input.date || '')) throw httpError(400, 'Valid date (YYYY-MM-DD) is required');
    out.date = input.date;
  }
  if (has('time')) {
    const t = input.time || '';
    if (t && !TIME_RE.test(t)) throw httpError(400, 'Time must be HH:mm (24h)');
    out.time = t;
  } else if (!partial) out.time = '';

  if (has('notes')) out.notes = String(input.notes || '').slice(0, 2000);
  else if (!partial) out.notes = '';

  if (has('priority')) out.priority = PRIORITIES.includes(input.priority) ? input.priority : 'medium';
  else if (!partial) out.priority = 'medium';

  if (has('category')) out.category = String(input.category || 'personal').toLowerCase().trim().slice(0, 30) || 'personal';
  else if (!partial) out.category = 'personal';

  if (has('remindBefore')) out.remindBefore = Math.max(0, Math.min(1440, Number(input.remindBefore) || 0));
  else if (!partial) out.remindBefore = 10;

  if (has('repeat')) out.repeat = REPEATS.includes(input.repeat) ? input.repeat : 'none';
  else if (!partial) out.repeat = 'none';

  if (has('status')) {
    if (!STATUSES.includes(input.status)) throw httpError(400, 'Invalid status');
    out.status = input.status;
  }
  if (has('reminderStage')) out.reminderStage = Math.max(0, Math.min(3, Number(input.reminderStage) || 0));
  if (has('snoozeUntil')) out.snoozeUntil = input.snoozeUntil || null;
  if (has('subtasks')) {
    const list = Array.isArray(input.subtasks) ? input.subtasks : [];
    out.subtasks = list.slice(0, 30).map((x) => (typeof x === 'string' ? { text: x } : x || {}))
      .map((x) => ({ id: x.id || randomUUID(), text: String(x.text || '').trim().slice(0, 200), done: Boolean(x.done) }))
      .filter((x) => x.text);
  } else if (!partial) out.subtasks = [];
  return out;
}

function sortTasks(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (!a.time && b.time) return 1;
  if (a.time && !b.time) return -1;
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : 1;
}

function isPast(date, time) {
  if (!time) return false;
  const tz = getDb().settings.timezone;
  return zonedTimeToUtc(date, time, tz) < Date.now() - 60000;
}

function build(p, source) {
  const past = isPast(p.date, p.time);
  return {
    id: randomUUID(),
    title: p.title,
    notes: p.notes ?? '',
    date: p.date,
    time: p.time ?? '',
    priority: p.priority ?? 'medium',
    category: p.category ?? 'personal',
    remindBefore: p.remindBefore ?? 10,
    repeat: p.repeat ?? 'none',
    status: 'pending',
    reminderStage: past ? 3 : p.reminderStage ?? 0, // in-app (browser) reminder stage
    notifyStage: past ? 3 : 0, // server push / Telegram / WhatsApp stage
    snoozeUntil: null,
    subtasks: (p.subtasks || []).map((x) => ({ ...x, done: false })),
    spawnedNext: false,
    source,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function findTask(id) {
  const t = getDb().tasks.find((x) => x.id === id);
  if (!t) throw httpError(404, 'Task not found');
  return t;
}

export function createTask(input, source = 'manual') {
  const t = build(clean(input), source);
  getDb().tasks.push(t);
  persist();
  return t;
}

function spawnNext(t, minDate) {
  let d = nextOccurrence(t.date, t.repeat);
  if (!d) return null;
  while (minDate && d < minDate) d = nextOccurrence(d, t.repeat);
  t.spawnedNext = true;
  const next = build({ ...t, date: d, reminderStage: 0 }, t.source);
  getDb().tasks.push(next);
  return next;
}

export function updateTask(id, patch) {
  const t = findTask(id);
  const p = clean(patch, true);
  const scheduleChanged = ('date' in p && p.date !== t.date) || ('time' in p && p.time !== t.time);
  if (scheduleChanged) {
    const past = isPast(p.date ?? t.date, p.time ?? t.time);
    if (!('reminderStage' in p)) p.reminderStage = past ? 3 : 0;
    p.notifyStage = past ? 3 : 0;
    p.snoozeUntil = null;
  }
  if ('status' in p && p.status !== t.status) {
    p.completedAt = p.status === 'done' ? new Date().toISOString() : null;
    if (p.status !== 'pending' && t.repeat !== 'none' && !t.spawnedNext) spawnNext(t);
    if (p.status === 'pending' && !scheduleChanged) p.reminderStage = t.reminderStage;
  }
  Object.assign(t, p);
  persist();
  return t;
}

export function snoozeTask(id, minutes = 10) {
  const t = findTask(id);
  const m = Math.max(1, Math.min(720, Number(minutes) || 10));
  t.snoozeUntil = new Date(Date.now() + m * 60000).toISOString();
  t.reminderStage = 1;
  t.notifyStage = 1;
  t.status = 'pending';
  persist();
  return t;
}

export function deleteTask(id) {
  const db = getDb();
  const t = findTask(id);
  db.tasks = db.tasks.filter((x) => x.id !== id);
  persist();
  return t;
}

// Make sure repeating tasks always have an upcoming copy
export function rollRecurring(today) {
  let changed = false;
  for (const t of [...getDb().tasks]) {
    if (t.repeat !== 'none' && !t.spawnedNext && t.date < today) {
      spawnNext(t, today);
      changed = true;
    }
  }
  if (changed) persist();
}

export function listTasks({ from, to } = {}) {
  return getDb()
    .tasks.filter((t) => (!from || t.date >= from) && (!to || t.date <= to))
    .sort(sortTasks);
}

export function getStats(today) {
  const { tasks, reviews } = getDb();
  const isDone = (t) => t.status === 'done';
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    const ts = tasks.filter((t) => t.date === date);
    week.push({ date, total: ts.length, done: ts.filter(isDone).length });
  }
  let streak = 0;
  let d = tasks.some((t) => t.date === today && isDone(t)) ? today : addDays(today, -1);
  while (tasks.some((t) => t.date === d && isDone(t))) {
    streak++;
    d = addDays(d, -1);
  }
  const todayTasks = tasks.filter((t) => t.date === today);
  const categories = {};
  for (const t of tasks.filter((x) => x.date >= addDays(today, -6) && x.date <= today)) {
    categories[t.category] = categories[t.category] || { total: 0, done: 0 };
    categories[t.category].total++;
    if (isDone(t)) categories[t.category].done++;
  }
  return {
    today: {
      total: todayTasks.length,
      done: todayTasks.filter(isDone).length,
      pending: todayTasks.filter((t) => t.status === 'pending').length,
      missed: todayTasks.filter((t) => t.status === 'missed').length,
    },
    overdue: tasks.filter((t) => t.date < today && t.status === 'pending').length,
    week,
    weekDone: week.reduce((s, x) => s + x.done, 0),
    weekTotal: week.reduce((s, x) => s + x.total, 0),
    streak,
    categories,
    reviewDone: reviews.some((r) => r.date === today),
  };
}

export function listReviews(limit = 14) {
  return [...getDb().reviews].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

export function saveReview(input) {
  const db = getDb();
  if (!DATE_RE.test(input.date || '')) throw httpError(400, 'Valid date required');
  const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 50) : []);
  const review = {
    id: randomUUID(),
    date: input.date,
    accomplished: arr(input.accomplished),
    notDone: arr(input.notDone ?? input.not_done),
    mood: String(input.mood || '').slice(0, 50),
    notes: String(input.notes || '').slice(0, 2000),
    tomorrowFocus: String(input.tomorrowFocus ?? input.tomorrow_focus ?? '').slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  db.reviews = db.reviews.filter((r) => r.date !== review.date);
  db.reviews.push(review);
  persist();
  return review;
}
