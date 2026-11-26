const TOKEN_KEY = 'daymate-token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function req(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith('/auth/')) onUnauthorized();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const q = (o) => new URLSearchParams(o).toString();

export const api = {
  health: () => req('/health'),
  // auth
  register: (b) => req('/auth/register', { method: 'POST', body: b }),
  login: (b) => req('/auth/login', { method: 'POST', body: b }),
  me: () => req('/auth/me'),
  // tasks
  tasks: (params) => req(`/tasks?${q(params)}`),
  createTask: (body) => req('/tasks', { method: 'POST', body }),
  updateTask: (id, body) => req(`/tasks/${id}`, { method: 'PATCH', body }),
  deleteTask: (id) => req(`/tasks/${id}`, { method: 'DELETE' }),
  snooze: (id, minutes) => req(`/tasks/${id}/snooze`, { method: 'POST', body: { minutes } }),
  // meta
  stats: (today) => req(`/stats?today=${today}`),
  settings: () => req('/settings'),
  saveSettings: (body) => req('/settings', { method: 'PUT', body }),
  reviews: () => req('/reviews'),
  agent: (body) => req('/agent/chat', { method: 'POST', body }),
  // habits
  habits: (today) => req(`/habits?today=${today}`),
  createHabit: (b) => req('/habits', { method: 'POST', body: b }),
  updateHabit: (id, b) => req(`/habits/${id}`, { method: 'PATCH', body: b }),
  deleteHabit: (id) => req(`/habits/${id}`, { method: 'DELETE' }),
  checkHabit: (id, date, done) => req(`/habits/${id}/check`, { method: 'POST', body: { date, done } }),
  // focus
  focus: (today) => req(`/focus?today=${today}`),
  logFocus: (b) => req('/focus', { method: 'POST', body: b }),
  // memory
  memory: () => req('/memory'),
  addMemory: (text) => req('/memory', { method: 'POST', body: { text } }),
  deleteMemory: (id) => req(`/memory/${id}`, { method: 'DELETE' }),
  // briefing / reports
  briefing: (today, refresh) => req(`/briefing?${q({ today, ...(refresh ? { refresh: 1 } : {}) })}`),
  reports: () => req('/reports'),
  weeklyReport: (today) => req('/reports/weekly', { method: 'POST', body: { today } }),
  // integrations
  integrations: () => req('/integrations/status'),
  pushSubscribe: (subscription) => req('/integrations/push/subscribe', { method: 'POST', body: { subscription } }),
  pushUnsubscribe: (endpoint) => req('/integrations/push/unsubscribe', { method: 'POST', body: { endpoint } }),
  testNotify: () => req('/integrations/test', { method: 'POST' }),
  telegramUnlink: () => req('/integrations/telegram/unlink', { method: 'POST' }),
  whatsappTest: () => req('/integrations/whatsapp/test', { method: 'POST' }),
  calendarSync: () => req('/integrations/calendar/sync', { method: 'POST' }),
};
