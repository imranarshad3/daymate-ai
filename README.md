# ✦ DayMate AI: aapka daily assistant

React + Node.js app jo aapke todos time ke saath set karti hai, waqt par **phone, Telegram ya WhatsApp** par remind karwati hai, follow-up mein poochti hai *"kya aap ne yeh kar liya?"*, habits aur focus track karti hai, aur ek **AI agent** se aapka din plan karwati hai.

## ✨ Features

| | |
|---|---|
| 🔐 **Accounts** | Email/password login (JWT). Har user ka data alag rehta hai |
| 🗄️ **Database** | MongoDB (`MONGODB_URI`), ya bina setup ke local JSON file |
| ⏰ **Smart reminders** | Pehle heads-up → waqt par popup + sound → follow-up *"kya kar liya?"*. Snooze, "Kal pe shift", "Nahi kiya" |
| 📱 **PWA + push** | Phone par install hoti hai. App band ho tab bhi notification aati hai, us mein **✅ Done / ⏰ 10 min** buttons hote hain |
| 💬 **Telegram** | Reminders buttons ke saath aate hain, aur aap bot se seedha agent ki tarah baat kar sakte hain |
| 🟢 **WhatsApp** | Twilio ke zariye reminders. "done" reply karne par task done ho jata hai, ya agent se chat kar sakte hain |
| ☀️ **Morning briefing** | Subah ek waqt par: aaj ke kaam, sab se zaroori task, habits |
| 🎙️ **Voice mode** | Orb par tap karke bolein, agent bol kar jawab deta hai aur phir se sunta hai |
| 📳 **Vibration** | Reminder, follow-up aur focus timer par phone vibrate karta hai (Off, Gentle, Normal, Strong). Task done karne par halka haptic |
| 🔔 **Notification access** | Login ke baad permission maangne wali sheet. iPhone par "Add to Home Screen" ki guide, aur block ho to wapas on karne ke steps |
| ✅ **Subtasks** | Har task ke andar checklist aur progress bar. Saare steps poore hon to task khud done ho jata hai |
| 🎯 **Focus timer** | Pomodoro (25/5, badla ja sakta hai), task se seedha ▶ dabayein. Har task par lagne wala time track hota hai |
| 📅 **Calendar view** | Mahine ka view, task drag karke doosre din par le ja sakte hain |
| 🔥 **Habit tracker** | Namaz, paani, gym jaise rozana ke kaam, streaks, 7 din ka grid aur 30 din ka % |
| 🗓️ **Google Calendar** | Import: iCal link se meetings khud tasks ban jati hain. Export: DayMate tasks Google Calendar mein |
| 📊 **Weekly report** | Har Sunday: kya achha gaya, kya baar baar miss hua, aur 3 suggestions |
| 🧠 **Smart reschedule** | Din overload ho to agent realistic plan banata hai. Pehle poochta hai, phir apply karta hai |
| 🆓 **Free AI** | Google Gemini + Groq. Ek fail ho to doosra backup |
| 🤖 **Agent memory** | Agent aapki routine yaad rakhta hai ("office 9–5") aur aapke patterns seekhta hai |
| 🎨 **Themes** | Mono Blue (default), Mono Light aur 6 aur themes. Font Geist hai, icons Phosphor |

## 🚀 Local setup

Node.js 18+ chahiye.

```bash
cd daymate
npm run setup
cp server/.env.example server/.env     # Windows: copy server\.env.example server\.env
npm run dev
```

Phir browser mein kholein: **http://localhost:5173**, account banayein aur shuru karein.
Purana (v1) data ho to woh pehle register hone wale account mein khud aa jata hai.

## 🔌 Integrations setup (sab optional)

Saari keys `server/.env` mein daalein aur server restart karein.

**🤖 AI agent (FREE: Gemini + Groq):**
```
GEMINI_API_KEY=...      # https://aistudio.google.com/apikey
GROQ_API_KEY=gsk_...    # https://console.groq.com/keys
AI_PROVIDER=gemini      # pehle kaun try ho; doosra khud backup ban jata hai
```
- App khud check karti hai ke aapki key par kaun se models available hain aur sab se achha chun leti hai: Gemini mein naya "flash" model, Groq mein Kimi K2 / GPT-OSS / Llama 3.3. Koi khaas model chahiye to `GEMINI_MODEL` ya `GROQ_MODEL` set karein.
- Ek provider ki limit khatam ho jaye ya woh fail ho jaye to doosra khud chal jata hai. Dono fail hon to app offline mode mein kaam karti rehti hai.
- Server start hone par terminal mein dikhega, jaise: `🤖 AI: Google Gemini (gemini-…-flash) → Groq (…)`
- Optional paid: `ANTHROPIC_API_KEY` bhi support hai.

**💬 Telegram (free, 2 minute):**
1. Telegram mein **@BotFather** kholein, `/newbot` likhein, naam dein aur token copy karein.
2. `.env` mein daalein: `TELEGRAM_BOT_TOKEN=123456:ABC...`
3. App mein **Settings → Telegram → Connect** dabayein, phir bot mein **Start** dabayein. ✅

**🟢 WhatsApp (Twilio):**
1. [twilio.com](https://www.twilio.com) par account banayein, phir **Messaging → Try it out → WhatsApp sandbox**.
2. Apne WhatsApp se sandbox number par "join xxx" code bhejein.
3. `.env` mein daalein:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_WHATSAPP_FROM=+14155238886
   ```
4. App mein **Settings → WhatsApp** par apna number daalein (+92…) aur **Test** dabayein.
5. Reply ke liye (deploy hone ke baad): Twilio sandbox mein *"When a message comes in"* = `https://YOUR-APP/api/integrations/whatsapp/webhook`

**📳 Vibration:** Android (Chrome, ya installed app) par kaam karti hai. iPhone web apps ko vibration control nahi deta, wahan notification ke saath sirf system haptic aata hai.

**📱 Push notifications:** **Settings → Push → Enable** dabayein. Phone par pehle browser menu se **Add to Home Screen** karein (iPhone par iOS 16.4+ mein home screen se kholna zaroori hai).
> Push ke liye HTTPS chahiye. `localhost` par chal jata hai, lekin phone par asli push ke liye app deploy karni hogi.

**🗓️ Google Calendar:**
- **Import:** Google Calendar → ⚙️ Settings → apna calendar → **Secret address in iCal format** → copy karke **Settings → Google Calendar** mein paste karein → Save. Har 15 minute mein sync hota hai.
- **Export:** Settings mein diya hua `.ics` link Google Calendar → Other calendars → **From URL** mein daalein.

## ☁️ Deploy (online live link)

**Render (free, aasaan):**
1. Code GitHub par push karein.
2. [render.com](https://render.com) par jayein, **New + → Blueprint** chunein aur repo select karein. `render.yaml` sab setup kar dega.
3. Environment mein yeh daalein:
   - `MONGODB_URI`: free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster ka link (zaroori hai, kyunke free hosting par files mit jati hain)
   - Baqi keys (AI, Telegram, Twilio) jo chahiye
   - VAPID keys: `node server/scripts-vapid.js` chala kar jo output aaye woh paste karein (taake push subscriptions hamesha kaam karein)
4. Deploy ho jaye to `https://daymate-ai-xxxx.onrender.com` kholein.

> Free plan par server 15 minute baad so jata hai, aur us waqt server se reminders nahi jate. Hamesha-on reminders ke liye paid "Starter" plan, Railway, ya koi VPS use karein.

**Docker (kisi bhi VPS par):**
```bash
docker build -t daymate .
docker run -d -p 5000:5000 --env-file server/.env -v daymate-data:/app/server/data daymate
```

## 📁 Structure

```
daymate/
├── server/                    Node.js + Express
│   ├── index.js
│   ├── lib/
│   │   ├── store.js           MongoDB / JSON storage
│   │   ├── auth.js            Register, login, JWT
│   │   ├── scheduler.js       Server reminders, briefing, review nudge, weekly report, calendar sync
│   │   ├── push.js            Web Push (VAPID)
│   │   ├── telegram.js        Telegram bot (reminders + agent chat)
│   │   ├── whatsapp.js        Twilio WhatsApp
│   │   ├── calendar.js        iCal import/export
│   │   ├── agent.js           AI agent (tools: tasks, subtasks, habits, memory, review)
│   │   ├── insights.js        Morning briefing + weekly report
│   │   ├── extras.js          Habits, focus, memory, patterns
│   │   └── tasks.js, nlp.js, dates.js, offlineAgent.js
│   └── routes/
├── client/                    React (Vite) PWA
│   ├── public/                sw.js, manifest, icons
│   └── src/
│       ├── App.jsx
│       ├── hooks/             useReminders, useFocus
│       └── components/        Auth, TaskItem, Calendar, Habits, Focus, Insights, Settings, AgentPanel…
├── Dockerfile, render.yaml
```
