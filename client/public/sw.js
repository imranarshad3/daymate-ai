/* DayMate service worker: background push notifications + action buttons */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'DayMate', body: event.data ? event.data.text() : '' };
  }
  const options = {
    body: data.body || '',
    tag: data.tag || 'daymate',
    renotify: true,
    requireInteraction: Boolean(data.requireInteraction),
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: data.url || '/', actionToken: data.actionToken, taskId: data.taskId },
    actions: data.actions || [],
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : [400, 150, 400, 150, 400],
    silent: Boolean(data.silent),
    timestamp: Date.now(),
  };
  event.waitUntil(self.registration.showNotification(data.title || 'DayMate', options));
});

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const { url, actionToken } = n.data || {};
  n.close();

  if ((event.action === 'done' || event.action === 'snooze') && actionToken) {
    event.waitUntil(
      fetch('/api/public/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: actionToken, action: event.action, minutes: 10 }),
      })
        .then((r) => r.json())
        .then((r) =>
          self.registration.showNotification(event.action === 'done' ? '✅ Done!' : '⏰ Snoozed 10 min', {
            body: r.task ? r.task.title : '',
            tag: 'daymate-ack',
            icon: '/icons/icon-192.png',
          })
        )
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then((list) => list.forEach((c) => c.postMessage({ type: 'daymate-refresh' })))
        .catch(() => {})
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.postMessage({ type: 'daymate-open', url });
          return c.focus();
        }
      }
      return self.clients.openWindow(url || '/');
    })
  );
});
