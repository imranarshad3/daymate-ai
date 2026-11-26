// Telegram bot: reminders with buttons + full agent chat. Uses long polling (works on localhost).
import crypto from 'crypto';
import { allUsers, userData } from './store.js';
import { withUser, getDb, persist } from './db.js';
import { updateTask, snoozeTask } from './tasks.js';
import { addDays, nowIn } from './dates.js';

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  }).then((r) => r.json());

let botUsername = null;
let chatHandler = null; // set by index.js -> (text, history) => agent reply

export const telegramEnabled = () => Boolean(TOKEN());
export const telegramBot = () => botUsername;

export function linkInfo() {
  const db = getDb();
  if (!db.integrations.telegramLinkCode) {
    db.integrations.telegramLinkCode = crypto.randomBytes(6).toString('hex');
    persist();
  }
  return {
    enabled: telegramEnabled(),
    bot: botUsername,
    linked: Boolean(db.integrations.telegramChatId),
    link: botUsername ? `https://t.me/${botUsername}?start=${db.integrations.telegramLinkCode}` : null,
  };
}

export function unlink() {
  const db = getDb();
  db.integrations.telegramChatId = null;
  db.integrations.telegramLinkCode = null;
  persist();
}

export async function sendTelegram(text, task) {
  if (!telegramEnabled()) return false;
  const chatId = getDb().integrations.telegramChatId;
  if (!chatId) return false;
  const reply_markup = task
    ? { inline_keyboard: [[
        { text: '✅ Done', callback_data: `done:${task.id}` },
        { text: '⏰ 10 min', callback_data: `snz:${task.id}` },
        { text: '📅 Kal', callback_data: `tmr:${task.id}` },
      ]] }
    : undefined;
  const r = await api('sendMessage', { chat_id: chatId, text: text.slice(0, 4000), reply_markup }).catch(() => null);
  return Boolean(r?.ok);
}

const userForChat = (chatId) => allUsers().find((u) => userData(u.id).integrations.telegramChatId === chatId);

async function handleUpdate(u) {
  if (u.callback_query) {
    const q = u.callback_query;
    const user = userForChat(q.message?.chat?.id);
    if (!user) return api('answerCallbackQuery', { callback_query_id: q.id, text: 'Account linked nahi hai' });
    const [action, taskId] = String(q.data || '').split(':');
    let note = '';
    await withUser(user.id, async () => {
      try {
        const tz = getDb().settings.timezone;
        if (action === 'done') { const t = updateTask(taskId, { status: 'done' }); note = `✅ Done: ${t.title}`; }
        if (action === 'snz') { const t = snoozeTask(taskId, 10); note = `⏰ 10 min baad yaad dilaunga: ${t.title}`; }
        if (action === 'tmr') { const t = updateTask(taskId, { date: addDays(nowIn(tz).date, 1), status: 'pending' }); note = `📅 Kal pe shift: ${t.title}`; }
      } catch (e) {
        note = `⚠️ ${e.message}`;
      }
    });
    await api('answerCallbackQuery', { callback_query_id: q.id, text: note.slice(0, 190) });
    if (q.message) await api('editMessageReplyMarkup', { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
    return api('sendMessage', { chat_id: q.message.chat.id, text: note });
  }

  const msg = u.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1];
    const user = code && allUsers().find((x) => userData(x.id).integrations.telegramLinkCode === code);
    if (!user) {
      return api('sendMessage', { chat_id: chatId, text: 'Assalam o Alaikum! 👋 DayMate app ki Settings → Telegram se "Connect" link khol kar account link karein.' });
    }
    withUser(user.id, () => {
      const db = getDb();
      db.integrations.telegramChatId = chatId;
      persist();
    });
    return api('sendMessage', { chat_id: chatId, text: '✅ DayMate connected! Ab reminders yahan aayenge.\nMujh se seedha baat karein, jaise: "kal 10:30 Ali ko call" ya "aaj kya baqi hai?"' });
  }

  const user = userForChat(chatId);
  if (!user) return api('sendMessage', { chat_id: chatId, text: 'Pehle app ki Settings se Telegram connect karein.' });
  if (!chatHandler) return;
  await api('sendChatAction', { chat_id: chatId, action: 'typing' });
  const reply = await withUser(user.id, async () => {
    const db = getDb();
    const history = [...db.chat.telegram, { role: 'user', content: text }].slice(-16);
    try {
      const r = await chatHandler(history, 'telegram');
      db.chat.telegram = [...history, { role: 'assistant', content: r.reply }].slice(-20);
      persist();
      return r.reply;
    } catch (e) {
      return `⚠️ ${e.message}`;
    }
  });
  return api('sendMessage', { chat_id: chatId, text: reply.slice(0, 4000) });
}

export async function startTelegram(handler) {
  chatHandler = handler;
  if (!telegramEnabled()) return;
  const me = await api('getMe').catch(() => null);
  if (!me?.ok) {
    console.error('[telegram] invalid TELEGRAM_BOT_TOKEN');
    return;
  }
  botUsername = me.result.username;
  await api('deleteWebhook').catch(() => null);
  console.log(`📨 Telegram bot: @${botUsername}`);
  let offset = 0;
  (async function loop() {
    for (;;) {
      try {
        const r = await api('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] });
        for (const u of r.result || []) {
          offset = u.update_id + 1;
          handleUpdate(u).catch((e) => console.error('[telegram]', e.message));
        }
      } catch {
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
  })();
}
