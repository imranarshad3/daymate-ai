// Request-scoped access to the current user's data.
// Every request (and every scheduler tick) runs inside withUser(userId, fn),
// so getDb()/persist() always point at the right account.
import { AsyncLocalStorage } from 'async_hooks';
import { userData, saveUserData, DEFAULT_SETTINGS } from './store.js';

export { DEFAULT_SETTINGS };
const als = new AsyncLocalStorage();

export function withUser(userId, fn) {
  return als.run({ userId }, fn);
}

export function currentUserId() {
  const id = als.getStore()?.userId;
  if (!id) throw new Error('No user context');
  return id;
}

export function getDb() {
  return userData(currentUserId());
}

export function persist() {
  saveUserData(currentUserId());
}
