import { Router } from 'express';
import { register, login, me, requireAuth } from '../lib/auth.js';

const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/register', ah(async (req, res) => res.status(201).json(await register(req.body || {}))));
router.post('/login', ah(async (req, res) => res.json(await login(req.body || {}))));
router.get('/me', requireAuth, (req, res) => res.json(me(req.userId)));

export default router;
