// Endpoints that don't need a login session (secured by signed tokens / secret keys)
import { Router, urlencoded } from 'express';
import { verifyToken } from '../lib/auth.js';
import { allUsers } from '../lib/store.js';
import { withUser, getDb } from '../lib/db.js';
import { updateTask, snoozeTask } from '../lib/tasks.js';
import { exportIcs } from '../lib/calendar.js';
import { whatsappWebhook } from '../lib/whatsapp.js';
import { chat } from '../lib/agent.js';

const router = Router();

// Notification action buttons (from the service worker)
router.post('/public/action', (req, res) => {
  const p = verifyToken(req.body?.token || '');
  if (!p?.uid || !p?.tid) return res.status(401).json({ error: 'Invalid token' });
  withUser(p.uid, () => {
    const t = req.body.action === 'snooze' ? snoozeTask(p.tid, req.body.minutes || 10) : updateTask(p.tid, { status: 'done' });
    res.json({ ok: true, task: { id: t.id, title: t.title, status: t.status } });
  });
});

// Calendar feed for Google Calendar "From URL"
router.get(/^\/calendar\/([a-f0-9]+)\.ics$/, (req, res) => {
  const user = allUsers().find((u) => u.feedKey === req.params[0]);
  if (!user) return res.status(404).send('Not found');
  withUser(user.id, () => res.type('text/calendar').send(exportIcs()));
});

// Twilio WhatsApp incoming webhook
router.post('/integrations/whatsapp/webhook', urlencoded({ extended: false }), whatsappWebhook((messages, channel) => chat({ messages, channel })));

export default router;
