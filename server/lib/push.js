// Web Push (PWA background notifications). VAPID keys are generated once and stored.
import * as webpushNs from 'web-push';

const webpush = webpushNs.default || webpushNs;
import { getMeta, setMeta } from './store.js';
import { getDb, persist } from './db.js';

let ready = false;

export function initPush() {
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const saved = getMeta('vapid');
    if (saved) ({ publicKey: pub, privateKey: priv } = saved);
    else {
      const k = webpush.generateVAPIDKeys();
      pub = k.publicKey;
      priv = k.privateKey;
      setMeta('vapid', k);
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:daymate@example.com', pub, priv);
  ready = true;
  return pub;
}

export const publicKey = () => process.env.VAPID_PUBLIC_KEY || getMeta('vapid')?.publicKey;

export function subscribe(sub) {
  if (!sub?.endpoint) throw Object.assign(new Error('Invalid subscription'), { status: 400 });
  const db = getDb();
  db.pushSubs = db.pushSubs.filter((s) => s.endpoint !== sub.endpoint);
  db.pushSubs.push({ endpoint: sub.endpoint, keys: sub.keys, createdAt: new Date().toISOString() });
  db.pushSubs = db.pushSubs.slice(-10);
  persist();
}

export function unsubscribe(endpoint) {
  const db = getDb();
  db.pushSubs = db.pushSubs.filter((s) => s.endpoint !== endpoint);
  persist();
}

// Must be called inside withUser()
export async function sendPushToUser(payload) {
  if (!ready) return 0;
  const db = getDb();
  let sent = 0;
  for (const sub of [...db.pushSubs]) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        db.pushSubs = db.pushSubs.filter((s) => s.endpoint !== sub.endpoint);
        persist();
      } else console.error('[push]', e.statusCode || '', e.body || e.message);
    }
  }
  return sent;
}
