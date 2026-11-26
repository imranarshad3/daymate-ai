import { Router } from 'express';
import { getDb, persist, DEFAULT_SETTINGS } from '../lib/db.js';
import { getStats, listReviews, saveReview, httpError } from '../lib/tasks.js';
import { nowIn } from '../lib/dates.js';

const router = Router();
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

router.get('/stats', (req, res) => {
  const today = req.query.today || nowIn(getDb().settings.timezone).date;
  res.json(getStats(String(today)));
});

router.get('/settings', (req, res) => res.json(getDb().settings));

router.put('/settings', (req, res) => {
  const db = getDb();
  const next = { ...db.settings };
  for (const key of Object.keys(DEFAULT_SETTINGS)) if (key in (req.body || {})) next[key] = req.body[key];
  for (const k of ['reviewTime', 'briefingTime']) if (!TIME.test(next[k] || '')) throw httpError(400, `Invalid ${k}`);
  next.followUpMinutes = Math.max(5, Math.min(240, Number(next.followUpMinutes) || 30));
  next.focusMinutes = Math.max(5, Math.min(120, Number(next.focusMinutes) || 25));
  next.breakMinutes = Math.max(1, Math.min(60, Number(next.breakMinutes) || 5));
  next.name = String(next.name || '').slice(0, 60);
  next.whatsappNumber = String(next.whatsappNumber || '').replace(/[^\d+]/g, '').slice(0, 20);
  next.icsUrl = String(next.icsUrl || '').trim().slice(0, 1000);
  if (!['off', 'gentle', 'normal', 'strong'].includes(next.vibration)) next.vibration = 'normal';
  for (const k of ['sound', 'speakReplies', 'briefingEnabled', 'weeklyReport']) next[k] = Boolean(next[k]);
  if (next.icsUrl !== db.settings.icsUrl) db.meta.lastIcsSync = null;
  db.settings = next;
  persist();
  res.json(next);
});

router.get('/reviews', (req, res) => res.json(listReviews(Number(req.query.limit) || 14)));
router.post('/reviews', (req, res) => res.status(201).json(saveReview(req.body || {})));

export default router;
