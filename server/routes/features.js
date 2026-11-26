import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { nowIn } from '../lib/dates.js';
import { createHabit, updateHabit, deleteHabit, setHabit, habitSummary, logFocus, focusStats, addMemory, deleteMemory } from '../lib/extras.js';
import { getBriefing, weeklyReport } from '../lib/insights.js';

const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const today = (req) => String(req.query.today || req.body?.today || nowIn(getDb().settings.timezone).date);

// Habits
router.get('/habits', (req, res) => res.json(habitSummary(today(req))));
router.post('/habits', (req, res) => res.status(201).json(createHabit(req.body || {})));
router.patch('/habits/:id', (req, res) => res.json(updateHabit(req.params.id, req.body || {})));
router.delete('/habits/:id', (req, res) => { deleteHabit(req.params.id); res.json({ ok: true }); });
router.post('/habits/:id/check', (req, res) => res.json({ done: setHabit(req.params.id, req.body?.date || today(req), req.body?.done) }));

// Focus
router.get('/focus', (req, res) => res.json(focusStats(today(req))));
router.post('/focus', (req, res) => res.status(201).json(logFocus({ ...req.body, date: req.body?.date || today(req) })));

// Agent memory
router.get('/memory', (req, res) => res.json(getDb().memory));
router.post('/memory', (req, res) => res.status(201).json(addMemory(req.body?.text)));
router.delete('/memory/:id', (req, res) => { deleteMemory(req.params.id); res.json({ ok: true }); });

// Briefing & reports
router.get('/briefing', ah(async (req, res) => res.json(await getBriefing(today(req), { force: req.query.refresh === '1' }))));
router.get('/reports', (req, res) => res.json(getDb().reports));
router.post('/reports/weekly', ah(async (req, res) => res.status(201).json(await weeklyReport(today(req)))));

export default router;
