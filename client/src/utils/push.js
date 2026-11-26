// PWA: service worker registration + Web Push subscription
import { api } from '../api.js';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

function urlB64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(publicKey) {
  if (!pushSupported()) throw new Error('Is browser mein push notifications supported nahi');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications ki permission nahi mili');
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerSW());
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) });
  await api.pushSubscribe(sub.toJSON());
  localStorage.setItem('daymate-push', '1');
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await api.pushUnsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  }
  localStorage.removeItem('daymate-push');
}

export const pushOnThisDevice = () => localStorage.getItem('daymate-push') === '1';
