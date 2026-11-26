import { Router } from 'express';
import { createTask, updateTask, deleteTask, listTasks, snoozeTask, rollRecurring } from '../lib/tasks.js';

const router = Router();

router.get('/', (req, res) => {
  const { from, to, today } = req.query;
  if (today) rollRecurring(String(today));
  res.json(listTasks({ from, to }));
});

router.post('/', (req, res) => res.status(201).json(createTask(req.body, 'manual')));
router.patch('/:id', (req, res) => res.json(updateTask(req.params.id, req.body)));
router.post('/:id/snooze', (req, res) => res.json(snoozeTask(req.params.id, req.body?.minutes)));
router.delete('/:id', (req, res) => {
  deleteTask(req.params.id);
  res.json({ ok: true });
});

export default router;
