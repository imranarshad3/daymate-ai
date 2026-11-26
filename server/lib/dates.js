// All dates are plain "YYYY-MM-DD" strings, times are "HH:mm" (24h).

export function nowIn(timeZone = 'Asia/Karachi', at = new Date()) {
  let tz = timeZone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    tz = 'UTC';
  }
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}`, tz };
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0 = Sunday
}

export function weekdayName(dateStr) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday(dateStr)];
}

export function nextOccurrence(dateStr, repeat) {
  switch (repeat) {
    case 'daily':
      return addDays(dateStr, 1);
    case 'weekly':
      return addDays(dateStr, 7);
    case 'weekdays': {
      let d = addDays(dateStr, 1);
      while ([0, 6].includes(weekday(d))) d = addDays(d, 1);
      return d;
    }
    case 'monthly': {
      const d = new Date(`${dateStr}T00:00:00Z`);
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 1);
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, last));
      return d.toISOString().slice(0, 10);
    }
    default:
      return null;
  }
}

function tzOffsetMs(timeZone, date) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, Number(x.value)]));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// "2026-11-26" + "10:30" in Asia/Karachi -> UTC epoch ms
export function zonedTimeToUtc(dateStr, timeStr, timeZone = 'UTC') {
  let tz = timeZone;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { tz = 'UTC'; }
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = tzOffsetMs(tz, new Date(guess));
  let ts = guess - off;
  const off2 = tzOffsetMs(tz, new Date(ts));
  if (off2 !== off) ts = guess - off2;
  return ts;
}
