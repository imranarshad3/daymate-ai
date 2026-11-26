// Habits, focus sessions, agent memory, behaviour patterns.
import { randomUUID } from 'crypto';
import { getDb, persist } from './db.js';
import { addDays, weekday } from './dates.js';
import { httpError } from './tasks.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------- Habits ----------------
function cleanHabit(input, partial = false) {
  const out = {};
  if (!partial || 'name' in input) {
    const name = String(input.name || '').trim().slice(0, 80);
    if (!name) throw httpError(400, 'Habit name is required');
    out.name = name;
  }
  if ('icon' in input || !partial) out.icon = String(input.icon || 'sparkle').slice(0, 30);
  if ('days' in input || !partial) {
    const days = Array.isArray(input.days) ? input.days.map(Number).filter((d) => d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6];
    out.days = days.length ? [...new Set(days)].sort() : [0, 1, 2, 3, 4, 5, 6];
  }
  if ('time' in input) out.time = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '') ? input.time : '';
  if ('archived' in input) out.archived = Boolean(input.archived);
  return out;
}

export function createHabit(input) {
  const db = getDb();
  const h = { id: randomUUID(), ...cleanHabit(input), time: input.time || '', archived: false, createdAt: new Date().toISOString() };
  db.habits.push(h);
  persist();
  return h;
}

export function updateHabit(id, patch) {
  const h = getDb().habits.find((x) => x.id === id);
  if (!h) throw httpError(404, 'Habit not found');
  Object.assign(h, cleanHabit(patch, true));
  persist();
  return h;
}

export function deleteHabit(id) {
  const db = getDb();
  if (!db.habits.some((h) => h.id === id)) throw httpError(404, 'Habit not found');
  db.habits = db.habits.filter((h) => h.id !== id);
  delete db.habitLogs[id];
  persist();
}

export function findHabit(idOrName) {
  const habits = getDb().habits.filter((h) => !h.archived);
  const q = String(idOrName || '').toLowerCase();
  return habits.find((h) => h.id === idOrName) || habits.find((h) => h.name.toLowerCase() === q) || habits.find((h) => h.name.toLowerCase().includes(q) || q.includes(h.name.toLowerCase()));
}

export function setHabit(id, date, done) {
  const db = getDb();
  if (!db.habits.some((h) => h.id === id)) throw httpError(404, 'Habit not found');
  if (!DATE_RE.test(date || '')) throw httpError(400, 'Valid date required');
  const log = new Set(db.habitLogs[id] || []);
  const value = done === undefined ? !log.has(date) : Boolean(done);
  if (value) log.add(date);
  else log.delete(date);
  db.habitLogs[id] = [...log].sort().slice(-400);
  persist();
  return value;
}

function habitStreak(h, log, today) {
  const scheduled = (d) => h.days.includes(weekday(d));
  let d = today;
  if (!log.has(today)) d = addDays(today, -1);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    if (scheduled(d)) {
      if (log.has(d)) streak++;
      else break;
    }
    d = addDays(d, -1);
  }
  return streak;
}

export function habitSummary(today) {
  const db = getDb();
  return db.habits
    .filter((h) => !h.archived)
    .map((h) => {
      const log = new Set(db.habitLogs[h.id] || []);
      const last7 = [];
      for (let i = 6; i >= 0; i--) {
        const d = addDays(today, -i);
        last7.push({ date: d, done: log.has(d), scheduled: h.days.includes(weekday(d)) });
      }
      const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, -i)).filter((d) => h.days.includes(weekday(d)));
      return {
        ...h,
        doneToday: log.has(today),
        scheduledToday: h.days.includes(weekday(today)),
        streak: habitStreak(h, log, today),
        rate30: last30.length ? Math.round((last30.filter((d) => log.has(d)).length / last30.length) * 100) : 0,
        last7,
      };
    });
}

// ---------------- Focus ----------------
export function logFocus({ taskId, title, minutes, date }) {
  const db = getDb();
  const m = Math.max(1, Math.min(240, Math.round(Number(minutes) || 0)));
  if (!DATE_RE.test(date || '')) throw httpError(400, 'Valid date required');
  const s = { id: randomUUID(), taskId: taskId || null, title: String(title || 'Focus session').slice(0, 200), minutes: m, date, endedAt: new Date().toISOString() };
  db.focus.push(s);
  if (db.focus.length > 2000) db.focus = db.focus.slice(-2000);
  persist();
  return s;
}

export function focusStats(today) {
  const db = getDb();
  const weekStart = addDays(today, -6);
  const todayS = db.focus.filter((f) => f.date === today);
  const week = db.focus.filter((f) => f.date >= weekStart && f.date <= today);
  const byTitle = {};
  for (const f of week) byTitle[f.title] = (byTitle[f.title] || 0) + f.minutes;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return { date: d, minutes: week.filter((f) => f.date === d).reduce((s, f) => s + f.minutes, 0) };
  });
  return {
    todayMinutes: todayS.reduce((s, f) => s + f.minutes, 0),
    todaySessions: todayS.length,
    weekMinutes: week.reduce((s, f) => s + f.minutes, 0),
    days,
    top: Object.entries(byTitle).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, minutes]) => ({ title, minutes })),
    recent: [...todayS].reverse().slice(0, 10),
  };
}

// ---------------- Agent memory ----------------
export function addMemory(text) {
  const db = getDb();
  const t = String(text || '').trim().slice(0, 300);
  if (!t) throw httpError(400, 'Memory text required');
  if (db.memory.some((m) => m.text.toLowerCase() === t.toLowerCase())) return db.memory.find((m) => m.text.toLowerCase() === t.toLowerCase());
  const m = { id: randomUUID().slice(0, 8), text: t, createdAt: new Date().toISOString() };
  db.memory.push(m);
  if (db.memory.length > 60) db.memory = db.memory.slice(-60);
  persist();
  return m;
}

export function deleteMemory(id) {
  const db = getDb();
  db.memory = db.memory.filter((m) => m.id !== id);
  persist();
}

// Patterns learned from history, e.g. "health tasks usually finished around 6 PM"
export function behaviourPatterns(tz) {
  const done = getDb().tasks.filter((t) => t.status === 'done' && t.completedAt).slice(-300);
  if (done.length < 5) return [];
  const hourOf = (iso) => Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date(iso)));
  const byCat = {};
  for (const t of done) (byCat[t.category] = byCat[t.category] || []).push(hourOf(t.completedAt));
  const out = [];
  for (const [cat, hours] of Object.entries(byCat)) {
    if (hours.length < 3) continue;
    const counts = {};
    for (const h of hours) counts[h] = (counts[h] || 0) + 1;
    const [peak] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    out.push(`${cat} tasks usually completed around ${peak}:00 (${hours.length} done)`);
  }
  const tasks = getDb().tasks;
  const missedCats = {};
  for (const t of tasks.filter((x) => x.status === 'missed')) missedCats[t.category] = (missedCats[t.category] || 0) + 1;
  const worst = Object.entries(missedCats).sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 3) out.push(`most often missed category: ${worst[0]} (${worst[1]} times)`);
  return out.slice(0, 6);
}
