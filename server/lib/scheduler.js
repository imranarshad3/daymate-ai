// Background scheduler (runs on the server every 30s, for every user):
//  - task reminders (heads-up -> due -> follow-up) via Web Push, Telegram, WhatsApp
//  - morning briefing, evening review nudge, Sunday weekly report
//  - calendar (iCal) sync every 15 minutes
import { allUsers } from './store.js';
import { withUser, getDb, persist, currentUserId } from './db.js';
import { nowIn, zonedTimeToUtc, weekday } from './dates.js';
import { signToken } from './auth.js';
import { sendPushToUser } from './push.js';
import { sendTelegram } from './telegram.js';
import { sendWhatsApp } from './whatsapp.js';
import { getBriefing, weeklyReport } from './insights.js';
import { syncIcs } from './calendar.js';
import { getStats } from './tasks.js';

const fmt = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const VIBE = {
  gentle: { pre: [80], due: [150, 100, 150], followup: [120, 80, 120], info: [100] },
  normal: { pre: [150, 80, 150], due: [400, 150, 400, 150, 400], followup: [250, 120, 250], info: [200, 100, 200] },
  strong: { pre: [300, 120, 300], due: [800, 200, 800, 200, 800, 200, 800], followup: [500, 150, 500, 150, 500], info: [400, 150, 400] },
};
const vibeFor = (level, kind) => (level === 'off' ? [] : (VIBE[level] || VIBE.normal)[kind] || (VIBE[level] || VIBE.normal).info);

const hasChannel = (db) => db.pushSubs.length > 0 || db.integrations.telegramChatId || db.settings.whatsappNumber;

// Send one message to every connected channel of the current user
export async function notify({ title, body, task, kind = 'info', url = '/' }) {
  const db = getDb();
  const out = { push: 0, telegram: false, whatsapp: false };
  const actionToken = task ? signToken({ uid: currentUserId(), tid: task.id }, '3d') : null;
  out.push = await sendPushToUser({
    title, body, tag: task ? `task-${task.id}` : `dm-${kind}`, url,
    vibrate: vibeFor(db.settings.vibration, kind), silent: db.settings.vibration === 'off' && !db.settings.sound,
    actionToken, taskId: task?.id, requireInteraction: kind === 'due' || kind === 'followup',
    actions: task ? [{ action: 'done', title: '✅ Done' }, { action: 'snooze', title: '⏰ 10 min' }] : [],
  });
  const text = `${title}\n${body}`;
  out.telegram = await sendTelegram(text, kind === 'pre' ? null : task);
  out.whatsapp = await sendWhatsApp(task && kind !== 'pre' ? `${text}\n\nReply "done" jab ho jaye.` : text);
  if (task && kind !== 'pre') {
    db.integrations.lastReminderTaskId = task.id;
    persist();
  }
  return out;
}

async function tickUser() {
  const db = getDb();
  const s = db.settings;
  const tz = s.timezone;
  const now = Date.now();
  const local = nowIn(tz);

  // ---- task reminders ----
  if (hasChannel(db)) {
    const follow = (s.followUpMinutes || 30) * 60000;
    for (const t of db.tasks) {
      if (t.status !== 'pending' || !t.time) continue;
      const due = zonedTimeToUtc(t.date, t.time, tz);
      const eff = t.snoozeUntil ? Date.parse(t.snoozeUntil) : due;
      if (now - eff > 6 * 3600000) continue;
      const st = t.notifyStage || 0;
      let kind = null;
      let next = st;
      if (st < 1 && t.remindBefore > 0 && now >= due - t.remindBefore * 60000 && now < due) { kind = 'pre'; next = 1; }
      else if (st < 2 && now >= eff) { kind = 'due'; next = 2; }
      else if (st === 2 && now >= eff + follow) { kind = 'followup'; next = 3; }
      if (!kind) continue;
      t.notifyStage = next;
      persist();
      const title = kind === 'pre' ? `⏳ ${t.remindBefore} min mein: ${t.title}` : kind === 'due' ? `⏰ Time ho gaya: ${t.title}` : `🤔 Kya aap ne "${t.title}" kar liya?`;
      const body = kind === 'followup' ? 'Done mark karein ya reschedule karein.' : `${fmt(t.time)}${t.notes ? ` · ${t.notes.slice(0, 80)}` : ''}`;
      await notify({ title, body, task: t, kind });
    }
  }

  const hhmm = local.time;
  // ---- morning briefing ----
  if (s.briefingEnabled && hhmm >= s.briefingTime && hhmm < '23:00' && db.meta.lastBriefing !== local.date) {
    db.meta.lastBriefing = local.date;
    persist();
    const b = await getBriefing(local.date);
    if (hasChannel(db)) await notify({ title: '☀️ Aaj ki briefing', body: b.text, kind: 'briefing' });
  }
  // ---- evening review nudge ----
  if (hhmm >= s.reviewTime && db.meta.lastReviewNudge !== local.date) {
    db.meta.lastReviewNudge = local.date;
    persist();
    const st = getStats(local.date);
    if (!st.reviewDone && hasChannel(db)) {
      await notify({ title: '🌙 Daily review ka time', body: `Aaj ${st.today.done}/${st.today.total} kaam hue. Batayein aaj kya kiya aur kal kya karna hai?`, kind: 'review', url: '/?agent=review' });
    }
  }
  // ---- weekly report (Sunday, at review time) ----
  if (s.weeklyReport && weekday(local.date) === 0 && hhmm >= s.reviewTime && db.meta.lastWeekly !== local.date) {
    db.meta.lastWeekly = local.date;
    persist();
    const r = await weeklyReport(local.date);
    if (hasChannel(db)) await notify({ title: '📊 Hafte ki report', body: r.text, kind: 'report', url: '/?view=insights' });
  }
  // ---- calendar sync ----
  if (s.icsUrl && (!db.meta.lastIcsSync || now - Date.parse(db.meta.lastIcsSync) > 15 * 60000)) {
    db.meta.lastIcsSync = new Date().toISOString();
    await syncIcs().catch(() => {});
  }
}

let running = false;
export function startScheduler() {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (const u of allUsers()) {
        await withUser(u.id, () => tickUser()).catch((e) => console.error('[scheduler]', u.email, e.message));
      }
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 3000);
  setInterval(tick, 30000);
}
