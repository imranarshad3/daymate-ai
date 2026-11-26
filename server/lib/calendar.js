// Google Calendar (or any calendar) sync via iCal:
//  - IMPORT: paste the calendar's "Secret address in iCal format" -> events become tasks
//  - EXPORT: subscribe to /api/calendar/<feedKey>.ics in Google Calendar -> tasks appear there
import { getDb, persist } from './db.js';
import { createTask } from './tasks.js';
import { addDays, nowIn, zonedTimeToUtc } from './dates.js';

function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseProp(line) {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const left = line.slice(0, i);
  const value = line.slice(i + 1);
  const [name, ...paramParts] = left.split(';');
  const params = Object.fromEntries(paramParts.map((p) => p.split('=')).map(([k, v]) => [k.toUpperCase(), v]));
  return { name: name.toUpperCase(), params, value };
}

const unescape = (s) => s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

// Returns { date, time } in the user's timezone
function toLocal(prop, userTz) {
  const v = prop.value.trim();
  if (prop.params.VALUE === 'DATE' || /^\d{8}$/.test(v)) return { date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, time: '' };
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const time = `${m[4]}:${m[5]}`;
  let utc;
  if (m[7]) utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  else utc = zonedTimeToUtc(date, time, prop.params.TZID || userTz);
  return nowIn(userTz, new Date(utc));
}

function parseEvents(text, userTz) {
  const events = [];
  let cur = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur?.start && cur.uid) events.push(cur);
      cur = null;
    } else if (cur) {
      const p = parseProp(line);
      if (!p) continue;
      if (p.name === 'UID') cur.uid = p.value;
      if (p.name === 'SUMMARY') cur.title = unescape(p.value);
      if (p.name === 'DESCRIPTION') cur.notes = unescape(p.value).slice(0, 500);
      if (p.name === 'LOCATION') cur.location = unescape(p.value);
      if (p.name === 'STATUS') cur.status = p.value;
      if (p.name === 'DTSTART') cur.start = toLocal(p, userTz);
      if (p.name === 'RRULE') cur.rrule = Object.fromEntries(p.value.split(';').map((x) => x.split('=')));
      if (p.name === 'RECURRENCE-ID') cur.recurrenceId = true;
    }
  }
  return events.filter((e) => e.status !== 'CANCELLED');
}

const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function expand(ev, from, to) {
  const out = [];
  const start = ev.start.date;
  if (!ev.rrule) return start >= from && start <= to ? [start] : [];
  const freq = ev.rrule.FREQ;
  const interval = Number(ev.rrule.INTERVAL || 1);
  const count = ev.rrule.COUNT ? Number(ev.rrule.COUNT) : Infinity;
  const until = ev.rrule.UNTIL ? `${ev.rrule.UNTIL.slice(0, 4)}-${ev.rrule.UNTIL.slice(4, 6)}-${ev.rrule.UNTIL.slice(6, 8)}` : '9999-12-31';
  const byday = ev.rrule.BYDAY ? ev.rrule.BYDAY.split(',').map((d) => DAYS[d.slice(-2)]).filter((d) => d !== undefined) : null;
  let n = 0;
  let d = start;
  for (let i = 0; i < 800 && d <= to && d <= until && n < count; i++) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    let match = false;
    if (freq === 'DAILY') match = Math.round((Date.parse(d) - Date.parse(start)) / 864e5) % interval === 0;
    else if (freq === 'WEEKLY') {
      const weeks = Math.floor(Math.round((Date.parse(d) - Date.parse(start)) / 864e5) / 7);
      match = weeks % interval === 0 && (byday ? byday.includes(wd) : wd === new Date(`${start}T00:00:00Z`).getUTCDay());
    } else if (freq === 'MONTHLY') match = d.slice(8) === start.slice(8);
    else if (freq === 'YEARLY') match = d.slice(5) === start.slice(5);
    if (match) {
      n++;
      if (d >= from) out.push(d);
    }
    d = addDays(d, 1);
  }
  return out;
}

export async function syncIcs() {
  const db = getDb();
  const url = (db.settings.icsUrl || '').trim().replace(/^webcal:\/\//i, 'https://');
  if (!url) return { imported: 0, removed: 0 };
  const tz = db.settings.timezone;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'DayMate/1.0' } });
    if (!res.ok) throw new Error(`Calendar fetch failed (${res.status})`);
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Yeh iCal (.ics) link nahi lagta');
    const today = nowIn(tz).date;
    const from = addDays(today, -1);
    const to = addDays(today, 30);
    const seen = new Set();
    let imported = 0;
    for (const ev of parseEvents(text, tz)) {
      if (ev.recurrenceId) continue;
      for (const date of expand(ev, from, to)) {
        const externalId = `${ev.uid}|${date}`;
        seen.add(externalId);
        const existing = db.tasks.find((t) => t.externalId === externalId);
        const title = ev.title || 'Calendar event';
        const notes = [ev.location, ev.notes].filter(Boolean).join('\n');
        if (existing) {
          if (existing.status === 'pending') Object.assign(existing, { title, time: ev.start.time, notes });
        } else {
          const t = createTask({ title, date, time: ev.start.time, category: 'work', notes, remindBefore: 10 }, 'calendar');
          t.externalId = externalId;
          imported++;
        }
      }
    }
    const before = db.tasks.length;
    db.tasks = db.tasks.filter((t) => !(t.source === 'calendar' && t.status === 'pending' && t.date >= from && t.date <= to && !seen.has(t.externalId)));
    db.meta.lastIcsSync = new Date().toISOString();
    db.meta.icsError = null;
    persist();
    return { imported, removed: before - db.tasks.length };
  } catch (e) {
    db.meta.icsError = e.message;
    persist();
    throw Object.assign(new Error(e.message), { status: 400 });
  }
}

const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function exportIcs() {
  const db = getDb();
  const tz = db.settings.timezone;
  const today = nowIn(tz).date;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DayMate AI//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:DayMate Tasks'];
  for (const t of db.tasks.filter((x) => x.date >= addDays(today, -14) && x.source !== 'calendar')) {
    lines.push('BEGIN:VEVENT', `UID:${t.id}@daymate`, `DTSTAMP:${stamp(Date.now())}`);
    if (t.time) {
      const start = zonedTimeToUtc(t.date, t.time, tz);
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(start + 30 * 60000)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${t.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(t.date, 1).replace(/-/g, '')}`);
    }
    lines.push(`SUMMARY:${t.status === 'done' ? '✓ ' : ''}${esc(t.title)}`);
    if (t.notes) lines.push(`DESCRIPTION:${esc(t.notes)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
