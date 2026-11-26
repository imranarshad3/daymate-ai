import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initStore, storeBackend, flushNow } from './lib/store.js';
import { requireAuth } from './lib/auth.js';
import { initPush } from './lib/push.js';
import { startTelegram, telegramEnabled } from './lib/telegram.js';
import { whatsappEnabled } from './lib/whatsapp.js';
import { startScheduler } from './lib/scheduler.js';
import { chat } from './lib/agent.js';
import { aiEnabled, aiInfo } from './lib/ai.js';
import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import metaRouter from './routes/meta.js';
import featuresRouter from './routes/features.js';
import integrationsRouter from './routes/integrations.js';
import agentRouter from './routes/agent.js';
import publicRouter from './routes/public.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await initStore();
initPush();

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res) =>
  res.json({
    ok: true,
    ai: aiEnabled(),
    aiProviders: await aiInfo(),
    telegram: telegramEnabled(),
    whatsapp: whatsappEnabled(),
    db: storeBackend(),
  })
);

app.use('/api', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api/agent', requireAuth, agentRouter);
app.use('/api/integrations', requireAuth, integrationsRouter);
app.use('/api', requireAuth, featuresRouter);
app.use('/api', requireAuth, metaRouter);

// Serve the built React app in production
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ DayMate API on http://localhost:${PORT}  (storage: ${storeBackend()})`);
  aiInfo().then((list) => console.log(list.length ? `🤖 AI: ${list.map((p) => `${p.label} (${p.model})`).join(' → ')}` : '🤖 AI agent: offline mode (add GEMINI_API_KEY or GROQ_API_KEY)'));
  console.log(whatsappEnabled() ? '💬 WhatsApp: ON' : '💬 WhatsApp: off (add Twilio keys)');
});

startTelegram((messages, channel) => chat({ messages, channel }));
startScheduler();

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try { flushNow(); } catch { /* ignore */ }
    process.exit(0);
  });
}
