// Storage layer. Two backends with the same API:
//   - MongoDB  (when MONGODB_URI is set)   -> collections: users, userdata, meta
//   - JSON file (default, zero setup)       -> server/data/db.json
// All user data is kept in memory and written back (debounced), so the rest of the
// app can read/write synchronously.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(__dirname, '..', 'data', 'db.json');

export const DEFAULT_SETTINGS = {
  name: '',
  timezone: 'Asia/Karachi',
  reviewTime: '21:00',
  followUpMinutes: 30,
  sound: true,
  voiceLang: 'en-IN',
  speakReplies: false,
  briefingEnabled: true,
  briefingTime: '08:00',
  weeklyReport: true,
  focusMinutes: 25,
  breakMinutes: 5,
  whatsappNumber: '',
  icsUrl: '',
  vibration: 'normal', // off | gentle | normal | strong
};

export function blankUserData() {
  return {
    tasks: [],
    reviews: [],
    habits: [],
    habitLogs: {}, // habitId -> ["YYYY-MM-DD", ...]
    focus: [], // { id, taskId, title, minutes, date, endedAt }
    memory: [], // { id, text, createdAt }
    reports: [], // weekly reports
    briefings: {}, // date -> text
    pushSubs: [],
    integrations: { telegramChatId: null, telegramLinkCode: null, lastReminderTaskId: null },
    chat: { telegram: [], whatsapp: [] },
    meta: { lastBriefing: null, lastReviewNudge: null, lastWeekly: null, lastIcsSync: null, icsError: null },
    settings: { ...DEFAULT_SETTINGS },
  };
}

function hydrate(d = {}) {
  const b = blankUserData();
  return {
    ...b,
    ...d,
    integrations: { ...b.integrations, ...(d.integrations || {}) },
    chat: { ...b.chat, ...(d.chat || {}) },
    meta: { ...b.meta, ...(d.meta || {}) },
    settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
  };
}

const state = { users: [], data: new Map(), meta: {}, legacy: null };
let backend = 'json';
let mongo = null;
const timers = new Map();

export async function initStore() {
  if (process.env.MONGODB_URI) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'daymate');
    mongo = { users: db.collection('users'), userdata: db.collection('userdata'), meta: db.collection('meta') };
    await mongo.users.createIndex({ email: 1 }, { unique: true });
    state.users = await mongo.users.find({}, { projection: { _id: 0 } }).toArray();
    for (const doc of await mongo.userdata.find({}).toArray()) {
      const { _id, ...rest } = doc;
      state.data.set(String(_id), hydrate(rest));
    }
    state.meta = (await mongo.meta.findOne({ _id: 'app' })) || {};
    delete state.meta._id;
    backend = 'mongo';
  } else {
    try {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (raw.users) {
        state.users = raw.users;
        for (const [id, d] of Object.entries(raw.data || {})) state.data.set(id, hydrate(d));
        state.meta = raw.meta || {};
        state.legacy = raw.legacy || null;
      } else if (raw.tasks) {
        // v1 single-user file -> given to the first account that registers
        state.legacy = raw;
        writeJson();
      }
    } catch {
      writeJson();
    }
  }
  return backend;
}

export const storeBackend = () => backend;

function writeJson() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const out = { users: state.users, data: Object.fromEntries(state.data), meta: state.meta, legacy: state.legacy };
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
  fs.renameSync(tmp, FILE);
}

function schedule(key, fn, delay = 400) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    Promise.resolve(fn()).catch((e) => console.error('[store] write failed:', e.message));
  }, delay));
}

// ---------- users ----------
export const allUsers = () => state.users;
export const findUserByEmail = (email) => state.users.find((u) => u.email === String(email).toLowerCase().trim());
export const findUser = (id) => state.users.find((u) => u.id === id);

export async function insertUser(user) {
  state.users.push(user);
  const data = blankUserData();
  if (state.legacy) {
    data.tasks = state.legacy.tasks || [];
    data.reviews = state.legacy.reviews || [];
    data.settings = { ...DEFAULT_SETTINGS, ...(state.legacy.settings || {}) };
    state.legacy = null;
  }
  state.data.set(user.id, data);
  if (backend === 'mongo') {
    await mongo.users.insertOne({ ...user });
    await mongo.userdata.replaceOne({ _id: user.id }, data, { upsert: true });
  } else writeJson();
  return user;
}

// ---------- user data ----------
export function userData(userId) {
  let d = state.data.get(userId);
  if (!d) {
    d = blankUserData();
    state.data.set(userId, d);
  }
  return d;
}

export function saveUserData(userId) {
  if (backend === 'mongo') {
    schedule(`u:${userId}`, () => mongo.userdata.replaceOne({ _id: userId }, state.data.get(userId), { upsert: true }));
  } else schedule('json', writeJson, 150);
}

export function flushNow() {
  if (backend === 'json') writeJson();
}

// ---------- app meta (VAPID keys, JWT secret) ----------
export function getMeta(key) {
  return state.meta[key];
}
export function setMeta(key, value) {
  state.meta[key] = value;
  if (backend === 'mongo') schedule('meta', () => mongo.meta.replaceOne({ _id: 'app' }, state.meta, { upsert: true }));
  else schedule('json', writeJson, 150);
}
