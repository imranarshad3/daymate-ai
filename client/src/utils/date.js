const pad = (n) => String(n).padStart(2, '0');

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return todayStr(dt);
}

export function dueDate(task) {
  const [y, m, d] = task.date.split('-').map(Number);
  const [hh, mm] = (task.time || '23:59').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0);
}

export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function relative(target, now = new Date()) {
  const diff = Math.round((target.getTime() - now.getTime()) / 60000);
  const abs = Math.abs(diff);
  let s;
  if (abs < 1) return 'abhi';
  if (abs < 60) s = `${abs} min`;
  else if (abs < 1440) s = `${Math.floor(abs / 60)}h ${abs % 60 ? `${abs % 60}m` : ''}`.trim();
  else s = `${Math.round(abs / 1440)}d`;
  return diff > 0 ? `in ${s}` : `${s} ago`;
}

export function dayLabel(date, today) {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  if (date === addDays(today, -1)) return 'Yesterday';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
