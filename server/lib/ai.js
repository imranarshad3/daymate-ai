// AI providers: Google Gemini + Groq (free tiers) and Anthropic (optional).
// Gemini and Groq both speak the OpenAI "chat/completions" format, so one client handles both.
// If the first provider fails (rate limit, outage), the next one is used automatically.

const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    key: () => process.env.GEMINI_API_KEY,
    base: () => process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
    envModel: () => process.env.GEMINI_MODEL,
    fallbackModel: 'gemini-2.5-flash',
    pick(ids) {
      // newest stable "gemini-X.Y-flash" (not lite / preview / tts / image / live)
      const ok = ids
        .map((id) => id.replace(/^models\//, ''))
        .filter((id) => /^gemini-\d+(\.\d+)?-flash$/.test(id))
        .sort((a, b) => parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1]));
      return ok[0];
    },
  },
  groq: {
    label: 'Groq',
    key: () => process.env.GROQ_API_KEY,
    base: () => process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    envModel: () => process.env.GROQ_MODEL,
    fallbackModel: 'llama-3.3-70b-versatile',
    pick(ids) {
      const prefs = [/^moonshotai\/kimi-k2/, /^openai\/gpt-oss-120b$/, /^llama-3\.3-70b-versatile$/, /^meta-llama\/llama-4-maverick/, /^qwen\/qwen3-32b$/];
      for (const re of prefs) {
        const hit = ids.filter((id) => re.test(id)).sort().reverse()[0];
        if (hit) return hit;
      }
      return undefined;
    },
  },
};

const modelCache = {};

async function resolveModel(name) {
  const p = PROVIDERS[name];
  if (p.envModel()) return p.envModel();
  if (modelCache[name]) return modelCache[name];
  try {
    const r = await fetch(`${p.base()}/models`, { headers: { Authorization: `Bearer ${p.key()}` }, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const ids = (data.data || data.models || []).map((m) => m.id || m.name).filter(Boolean);
    modelCache[name] = p.pick(ids) || p.fallbackModel;
  } catch {
    modelCache[name] = p.fallbackModel;
  }
  return modelCache[name];
}

// Order of providers to try
export function providerOrder() {
  const forced = (process.env.AI_PROVIDER || '').toLowerCase();
  const all = [];
  if (process.env.ANTHROPIC_API_KEY) all.push('anthropic');
  if (process.env.GEMINI_API_KEY) all.push('gemini');
  if (process.env.GROQ_API_KEY) all.push('groq');
  // default preference: Gemini → Groq → Anthropic
  const rank = { gemini: 0, groq: 1, anthropic: 2 };
  all.sort((a, b) => rank[a] - rank[b]);
  if (forced && all.includes(forced)) return [forced, ...all.filter((x) => x !== forced)];
  return all;
}

export const aiEnabled = () => providerOrder().length > 0;

export async function aiInfo() {
  const order = providerOrder();
  const out = [];
  for (const n of order) out.push({ id: n, label: n === 'anthropic' ? 'Anthropic Claude' : PROVIDERS[n].label, model: n === 'anthropic' ? anthropicModel() : await resolveModel(n) });
  return out;
}

// ---------------- OpenAI-compatible (Gemini, Groq) ----------------
async function compatChat(name, body) {
  const p = PROVIDERS[name];
  const model = await resolveModel(name);
  const res = await fetch(`${p.base()}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0.5, ...body }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (Array.isArray(data) ? data[0]?.error?.message : data?.error?.message) || res.statusText;
    const e = new Error(`${p.label} error (${res.status}): ${msg}`);
    e.status = 502;
    e.retryable = res.status === 429 || res.status >= 500 || res.status === 404;
    throw e;
  }
  return data;
}

const toOpenAITools = (tools) =>
  tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));

async function compatAgent(name, { system, messages, tools, onTool }) {
  const msgs = [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
  let executed = 0;
  for (let i = 0; i < 10; i++) {
    const data = await compatChat(name, { messages: msgs, tools: toOpenAITools(tools), tool_choice: 'auto' }).catch((e) => {
      e.executed = executed;
      throw e;
    });
    const msg = data.choices?.[0]?.message || {};
    const calls = msg.tool_calls || [];
    if (!calls.length) return (msg.content || '').trim();
    msgs.push({ ...msg, content: msg.content ?? '' }); // keep provider fields (e.g. Gemini thought signatures)
    for (const c of calls) {
      let args = {};
      try { args = typeof c.function?.arguments === 'string' ? JSON.parse(c.function.arguments || '{}') : c.function?.arguments || {}; } catch { /* bad json */ }
      const content = onTool(c.function?.name, args);
      executed++;
      msgs.push({ role: 'tool', tool_call_id: c.id, name: c.function?.name, content });
    }
  }
  return '';
}

// ---------------- Anthropic ----------------
const anthropicModel = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

async function callClaude(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: anthropicModel(), ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(`Claude error (${res.status}): ${data?.error?.message || 'request failed'}`);
    e.status = 502;
    e.retryable = res.status === 429 || res.status >= 500;
    throw e;
  }
  return data;
}

async function anthropicAgent({ system, messages, tools, onTool }) {
  const msgs = messages.map((m) => ({ role: m.role, content: m.content }));
  let executed = 0;
  for (let i = 0; i < 10; i++) {
    const data = await callClaude({ max_tokens: 1200, system, tools, messages: msgs }).catch((e) => { e.executed = executed; throw e; });
    msgs.push({ role: 'assistant', content: data.content });
    const uses = (data.content || []).filter((b) => b.type === 'tool_use');
    if (data.stop_reason !== 'tool_use' || !uses.length) return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    msgs.push({
      role: 'user',
      content: uses.map((u) => { executed++; return { type: 'tool_result', tool_use_id: u.id, content: onTool(u.name, u.input || {}) }; }),
    });
  }
  return '';
}

// ---------------- Public API ----------------
/** Run the tool-using agent. Falls back to the next provider on failure (if no tool ran yet). */
export async function runAgent(opts) {
  let lastErr;
  for (const name of providerOrder()) {
    try {
      const reply = name === 'anthropic' ? await anthropicAgent(opts) : await compatAgent(name, opts);
      return { reply, provider: name };
    } catch (e) {
      lastErr = e;
      console.error(`[ai] ${name} failed:`, e.message);
      if (e.executed > 0) break; // don't repeat actions on another provider
    }
  }
  throw lastErr || new Error('No AI provider configured');
}

/** One-shot text (briefings, reports). Returns null on failure so callers can use a template. */
export async function writeText(system, prompt, maxTokens = 700) {
  for (const name of providerOrder()) {
    try {
      if (name === 'anthropic') {
        const data = await callClaude({ max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] });
        const t = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        if (t) return t;
      } else {
        const data = await compatChat(name, { messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: maxTokens });
        const t = (data.choices?.[0]?.message?.content || '').trim();
        if (t) return t;
      }
    } catch (e) {
      console.error(`[ai] ${name} writeText failed:`, e.message);
    }
  }
  return null;
}
