import { Router } from 'express';
import { chat } from '../lib/agent.js';

const router = Router();

router.post('/chat', async (req, res, next) => {
  try {
    const { messages, kickoff } = req.body || {};
    res.json(await chat({ messages: Array.isArray(messages) ? messages : [], kickoff, channel: 'app' }));
  } catch (e) {
    next(e);
  }
});

export default router;
