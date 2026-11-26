import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, findUser, insertUser, getMeta, setMeta } from './store.js';
import { withUser } from './db.js';
import { httpError } from './tasks.js';

function secret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  let s = getMeta('jwtSecret');
  if (!s) {
    s = crypto.randomBytes(48).toString('hex');
    setMeta('jwtSecret', s);
  }
  return s;
}

export const signToken = (payload, expiresIn = '30d') => jwt.sign(payload, secret(), { expiresIn });
export function verifyToken(token) {
  try {
    return jwt.verify(token, secret());
  } catch {
    return null;
  }
}

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt });

export async function register({ email, password, name }) {
  email = String(email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Valid email chahiye');
  if (String(password || '').length < 6) throw httpError(400, 'Password kam az kam 6 characters ka ho');
  if (findUserByEmail(email)) throw httpError(409, 'Is email se account pehle se mojood hai');
  const user = {
    id: crypto.randomUUID(),
    email,
    name: String(name || '').trim().slice(0, 60),
    passwordHash: await bcrypt.hash(password, 10),
    feedKey: crypto.randomBytes(16).toString('hex'),
    createdAt: new Date().toISOString(),
  };
  await insertUser(user);
  return { token: signToken({ uid: user.id }), user: publicUser(user) };
}

export async function login({ email, password }) {
  const user = findUserByEmail(email || '');
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    throw httpError(401, 'Email ya password ghalat hai');
  }
  return { token: signToken({ uid: user.id }), user: publicUser(user) };
}

export function me(userId) {
  const u = findUser(userId);
  return u ? publicUser(u) : null;
}

// Express middleware: requires "Authorization: Bearer <token>"
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token && verifyToken(token);
  if (!payload?.uid || !findUser(payload.uid)) return res.status(401).json({ error: 'Please login again' });
  req.userId = payload.uid;
  withUser(payload.uid, () => next());
}
