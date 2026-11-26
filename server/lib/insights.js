// Morning briefing + weekly report (AI-written when a key is set, template otherwise)
import { randomUUID } from 'crypto';
import { getDb, persist } from './db.js';
import { addDays, weekdayName } from './dates.js';
import { getStats } from './tasks.js';
import { habitSummary, focusStats } from './extras.js';
import { writeText } from './ai.js';

const fmt = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const STYLE = 'Write in Roman Urdu mixed with English (Hinglish/Urdu-English), warm and motivating, like a personal coach. Plain text, short lines, use "- " for bullets. No markdown headings.';

export async function getBriefing(today, { force = false } = {}) {
  const db = getDb();
  const tasks = db.tasks.filter((t) => t.date === today && t.status === 'pending');
  const sig = tasks.map((t) => `${t.id}${t.time}`).sort().join('|') + `#${db.habits.length}`;
  db.briefingSig = db.briefingSig || {};
  if (!force && db.briefings[today] && db.briefingSig[today] === sig) return { date: today, text: db.briefings[today] };

  const overdue = db.tasks.filter((t) => t.date < today && t.status === 'pending');
  const habits = habitSummary(today).filter((h) => h.scheduledToday);
  const top = [...tasks].sort((a, b) => (b.priority === 'high') - (a.priority === 'high'))[0];
  const name = db.settings.name;

  const data = {
    date: `${today} (${weekdayName(today)})`, name,
    tasks: tasks.map((t) => ({ title: t.title, time: t.time || null, priority: t.priority, subtasks: t.subtasks?.length || 0 })),
    overdue: overdue.map((t) => t.title).slice(0, 8),
    habits: habits.map((h) => ({ name: h.name, streak: h.streak })),
    yesterdayFocus: db.reviews.find((r) => r.date === addDays(today, -1))?.tomorrowFocus || null,
  };

  let text = await writeText(
    `You are DayMate, a personal productivity agent. ${STYLE} Max ~10 lines.`,
    `Write this morning's briefing. Greet by name if known. Say how many tasks today, list timed ones in order (with times), name the single most important task, mention overdue items briefly and suggest handling them, remind habits with streaks. End with one short motivating line.\nDATA: ${JSON.stringify(data)}`
  );
  if (!text) {
    const lines = [`Subah bakhair${name ? ` ${name}` : ''}! ☀️ Aaj ${weekdayName(today)} hai.`];
    lines.push(tasks.length ? `Aaj aap ke ${tasks.length} kaam hain:` : 'Aaj ke liye abhi koi task nahi — planning karein?');
    for (const t of tasks.slice(0, 8)) lines.push(`- ${t.time ? `${fmt(t.time)} — ` : ''}${t.title}`);
    if (top) lines.push(`\nSab se zaroori: ${top.title}`);
    if (overdue.length) lines.push(`${overdue.length} purane kaam baqi hain — aaj nipta dein ya reschedule karein.`);
    if (habits.length) lines.push(`Habits: ${habits.map((h) => `${h.name}${h.streak ? ` (${h.streak}🔥)` : ''}`).join(', ')}`);
    lines.push('\nAap kar sakte hain! 💪');
    text = lines.join('\n');
  }
  db.briefings[today] = text;
  db.briefingSig[today] = sig;
  const keys = Object.keys(db.briefings).sort();
  for (const k of keys.slice(0, -14)) { delete db.briefings[k]; delete db.briefingSig[k]; }
  persist();
  return { date: today, text };
}

export async function weeklyReport(today) {
  const db = getDb();
  const from = addDays(today, -6);
  const stats = getStats(today);
  const week = db.tasks.filter((t) => t.date >= from && t.date <= today);
  const missed = week.filter((t) => t.status === 'missed' || (t.status === 'pending' && t.date < today));
  const byCat = {};
  for (const t of week) {
    byCat[t.category] = byCat[t.category] || { total: 0, done: 0 };
    byCat[t.category].total++;
    if (t.status === 'done') byCat[t.category].done++;
  }
  const habits = habitSummary(today).map((h) => ({ name: h.name, done7: h.last7.filter((d) => d.done).length, scheduled7: h.last7.filter((d) => d.scheduled).length, streak: h.streak }));
  const focus = focusStats(today);
  const reviews = db.reviews.filter((r) => r.date >= from).map((r) => ({ date: r.date, mood: r.mood, notes: r.notes }));
  const data = {
    period: `${from} → ${today}`, completed: stats.weekDone, planned: stats.weekTotal,
    rate: stats.weekTotal ? Math.round((stats.weekDone / stats.weekTotal) * 100) : 0,
    streak: stats.streak, byCategory: byCat, missed: missed.map((t) => t.title).slice(0, 12),
    habits, focusMinutes: focus.weekMinutes, topFocus: focus.top, reviews,
  };

  let text = await writeText(
    `You are DayMate, a personal productivity coach. ${STYLE} Max ~16 lines.`,
    `Write the weekly report: 1) headline number (completion %), 2) what went well (2-3 bullets), 3) patterns of what kept getting missed and why it might be, 4) habits & focus summary, 5) exactly 3 concrete suggestions for next week. DATA: ${JSON.stringify(data)}`,
    900
  );
  if (!text) {
    const best = Object.entries(byCat).sort((a, b) => b[1].done / b[1].total - a[1].done / a[1].total)[0];
    text = [
      `📊 Hafte ki report (${from} → ${today})`,
      `- ${data.completed}/${data.planned} tasks complete (${data.rate}%)`,
      `- Streak: ${data.streak} din 🔥`,
      best ? `- Sab se acha: ${best[0]} (${best[1].done}/${best[1].total})` : null,
      missed.length ? `- Miss hue: ${missed.slice(0, 5).map((t) => t.title).join(', ')}` : '- Koi kaam miss nahi hua! 🎉',
      habits.length ? `- Habits: ${habits.map((h) => `${h.name} ${h.done7}/${h.scheduled7}`).join(', ')}` : null,
      `- Focus: ${Math.round(data.focusMinutes / 6) / 10} ghante`,
      '',
      'Agle hafte ke liye:',
      '- Har din sirf 3 sab se zaroori kaam pehle rakhein',
      missed.length ? '- Jo kaam bar bar miss hote hain unhein chhote steps (subtasks) mein todein' : '- Isi raftar ko qaim rakhein',
      '- Raat ko 5 minute review zaroor karein',
    ].filter((x) => x !== null).join('\n');
  }
  const report = { id: randomUUID(), weekEnding: today, from, text, stats: { completed: data.completed, planned: data.planned, rate: data.rate, focusMinutes: data.focusMinutes }, createdAt: new Date().toISOString() };
  db.reports = [report, ...db.reports.filter((r) => r.weekEnding !== today)].slice(0, 26);
  persist();
  return report;
}
