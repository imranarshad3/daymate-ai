// WhatsApp via Twilio. Outgoing reminders + incoming replies (webhook) routed to the agent.
import { allUsers, userData } from './store.js';
import { withUser, getDb, persist } from './db.js';

const cfg = () => ({
  sid: process.env.TWILIO_ACCOUNT_SID,
  token: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_WHATSAPP_FROM, // e.g. "+14155238886" (Twilio sandbox number)
});
export const whatsappEnabled = () => Boolean(cfg().sid && cfg().token && cfg().from);

const norm = (n) => String(n || '').replace(/^whatsapp:/, '').replace(/[^\d+]/g, '');
const digits = (n) => String(n || '').replace(/\D/g, '');

export async function sendWhatsApp(text) {
  if (!whatsappEnabled()) return false;
  let to = norm(getDb().settings.whatsappNumber);
  if (to && !to.startsWith('+')) to = `+${to}`;
  if (!to) return false;
  const { sid, token, from } = cfg();
  const body = new URLSearchParams({ From: `whatsapp:${norm(from)}`, To: `whatsapp:${to}`, Body: text.slice(0, 1500) });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body,
  }).catch(() => null);
  if (!r?.ok) console.error('[whatsapp] send failed', r?.status);
  return Boolean(r?.ok);
}

const xml = (s) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

// Express handler for Twilio's incoming-message webhook
export function whatsappWebhook(chatHandler) {
  return async (req, res) => {
    const from = digits(req.body?.From);
    const text = String(req.body?.Body || '').trim();
    const user = allUsers().find((u) => from && digits(userData(u.id).settings.whatsappNumber) === from);
    let reply = 'Yeh number DayMate se linked nahi hai. App ki Settings mein apna WhatsApp number add karein.';
    if (user && text) {
      reply = await withUser(user.id, async () => {
        const db = getDb();
        const history = [...db.chat.whatsapp, { role: 'user', content: text }].slice(-16);
        try {
          const r = await chatHandler(history, 'whatsapp');
          db.chat.whatsapp = [...history, { role: 'assistant', content: r.reply }].slice(-20);
          persist();
          return r.reply;
        } catch (e) {
          return `⚠️ ${e.message}`;
        }
      });
    }
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xml(reply)}</Message></Response>`);
  };
}
