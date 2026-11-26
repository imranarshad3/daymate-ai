import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { findUser } from '../lib/store.js';
import { publicKey, subscribe, unsubscribe } from '../lib/push.js';
import { linkInfo, unlink, telegramEnabled } from '../lib/telegram.js';
import { whatsappEnabled, sendWhatsApp } from '../lib/whatsapp.js';
import { syncIcs } from '../lib/calendar.js';
import { notify } from '../lib/scheduler.js';
import { httpError } from '../lib/tasks.js';

const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/status', (req, res) => {
  const db = getDb();
  const user = findUser(req.userId);
  res.json({
    push: { publicKey: publicKey(), devices: db.pushSubs.length },
    telegram: linkInfo(),
    whatsapp: { enabled: whatsappEnabled(), number: db.settings.whatsappNumber, sandboxFrom: process.env.TWILIO_WHATSAPP_FROM || null },
    calendar: { icsUrl: db.settings.icsUrl, lastSync: db.meta.lastIcsSync, error: db.meta.icsError, feedPath: `/api/calendar/${user.feedKey}.ics` },
  });
});

router.post('/push/subscribe', (req, res) => { subscribe(req.body?.subscription); res.json({ ok: true }); });
router.post('/push/unsubscribe', (req, res) => { unsubscribe(req.body?.endpoint); res.json({ ok: true }); });
router.post('/test', ah(async (req, res) => {
  const r = await notify({ title: '🔔 DayMate test', body: 'Notifications kaam kar rahi hain ✅', kind: 'test' });
  res.json(r);
}));

router.post('/telegram/unlink', (req, res) => { unlink(); res.json({ ok: true }); });
router.post('/whatsapp/test', ah(async (req, res) => {
  if (!whatsappEnabled()) throw httpError(400, 'Server par Twilio configure nahi hai');
  res.json({ ok: await sendWhatsApp('👋 DayMate WhatsApp connected! Reminders yahan aayenge.') });
}));
router.post('/calendar/sync', ah(async (req, res) => res.json(await syncIcs())));
router.get('/features', (req, res) => res.json({ telegram: telegramEnabled(), whatsapp: whatsappEnabled() }));

export default router;
