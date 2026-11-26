import { useCallback, useEffect, useState } from 'react';
import {
  Bell, BellRinging, Moon, User, SpeakerHigh, Microphone, Timer, CheckCircle, Palette, Check, DeviceMobile, TelegramLogo,
  WhatsappLogo, GoogleLogo, Brain, Trash, SignOut, SunHorizon, ArrowsClockwise, Copy, Robot, ChartBar, Target, Plus, LinkSimple, Vibrate, ShieldCheck,
} from '@phosphor-icons/react';
import { api } from '../api.js';
import { THEMES } from '../utils/themes.js';
import { enablePush, disablePush, pushSupported, pushOnThisDevice } from '../utils/push.js';
import { vibrate, canVibrate, platform } from '../utils/haptics.js';

const VIBES = [['off', 'Off'], ['gentle', 'Gentle'], ['normal', 'Normal'], ['strong', 'Strong']];

export default function SettingsView({ settings, onSave, onTestReminder, onNotifyAccess, health, theme, onTheme, user, onLogout, toast }) {
  const [s, setS] = useState(settings || {});
  const [saved, setSaved] = useState(false);
  const [integ, setInteg] = useState(null);
  const [memory, setMemory] = useState([]);
  const [newMem, setNewMem] = useState('');
  const [pushOn, setPushOn] = useState(pushOnThisDevice());
  const [busy, setBusy] = useState('');
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const plat = platform();

  useEffect(() => setS(settings || {}), [settings]);
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const loadInteg = useCallback(() => api.integrations().then(setInteg).catch(() => {}), []);
  useEffect(() => {
    loadInteg();
    api.memory().then(setMemory).catch(() => {});
  }, [loadInteg]);

  async function save(patch) {
    try {
      await onSave(patch ? { ...s, ...patch } : s);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      loadInteg();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function togglePush() {
    setBusy('push');
    try {
      if (pushOn) { await disablePush(); setPushOn(false); toast('Push notifications off', 'info'); }
      else { await enablePush(integ.push.publicKey); setPushOn(true); toast('Push notifications on ✓ — app band ho tab bhi reminder aayega'); }
      loadInteg();
    } catch (e) { toast(e.message, 'error'); }
    setBusy('');
  }

  async function run(key, fn, ok) {
    setBusy(key);
    try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); loadInteg(); } catch (e) { toast(e.message, 'error'); }
    setBusy('');
  }

  const feedUrl = integ ? `${window.location.origin}${integ.calendar.feedPath}` : '';
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast('Copied ✓', 'info'));

  return (
    <div className="settings">
      {/* Appearance */}
      <div className="card">
        <h3><Palette size={18} /> Appearance</h3>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button key={t.id} className={`theme-card ${theme === t.id ? 'on' : ''}`} onClick={() => onTheme(t.id)}>
              <div className="theme-preview" style={{ background: t.swatch[0] }}>
                <span style={{ background: `linear-gradient(135deg, ${t.swatch[1]}, ${t.swatch[2]})` }} />
                <i style={{ background: t.swatch[1] }} />
                <i style={{ background: t.swatch[2], width: '40%' }} />
                {theme === t.id && <em><Check size={12} weight="bold" /></em>}
              </div>
              <b>{t.name}</b>
              <small>{t.desc}</small>
            </button>
          ))}
        </div>
      </div>

      {/* Notifications & channels */}
      <div className="card">
        <h3><BellRinging size={18} /> Reminders kahan aayein?</h3>
        <p className="muted">App ke andar popup hamesha aata hai. Neeche wale channels server se aate hain, is liye app band ho tab bhi reminder milega.</p>

        <div className="integ">
          <div className="integ-icon push"><ShieldCheck size={22} /></div>
          <div className="integ-body">
            <b>Phone notification access</b>
            <span className="muted small">
              {perm === 'granted' ? 'Allowed ✓' : perm === 'denied' ? 'Blocked — "Fix" dabayein, steps dikhayenge' : perm === 'unsupported' ? 'Is browser mein supported nahi' : 'Abhi permission nahi di'}
              {plat.ios && !plat.standalone ? ' · iPhone: pehle Add to Home Screen' : ''}
            </span>
          </div>
          {perm !== 'granted' && <button className="btn primary sm" onClick={onNotifyAccess}>{perm === 'denied' ? 'Fix' : 'Allow'}</button>}
        </div>

        <div className="integ">
          <div className="integ-icon push"><Vibrate size={22} /></div>
          <div className="integ-body">
            <b>Vibration</b>
            <span className="muted small">{canVibrate() ? 'Reminder, follow-up aur focus timer par phone vibrate karega' : 'Is device/browser par vibration supported nahi (iPhone par sirf notification haptic)'}</span>
            <div className="seg vibe-seg mt8">
              {VIBES.map(([v, l]) => (
                <button key={v} type="button" className={(s.vibration || 'normal') === v ? 'on' : ''} style={{ '--c': 'var(--accent)' }}
                  onClick={() => { set('vibration', v); save({ vibration: v }); vibrate('due', v); }}>{l}</button>
              ))}
            </div>
          </div>
          <button className="btn sm" disabled={!canVibrate() || s.vibration === 'off'} onClick={() => vibrate('due', s.vibration || 'normal')}>Test</button>
        </div>

        <div className="integ">
          <div className="integ-icon push"><DeviceMobile size={22} /></div>
          <div className="integ-body">
            <b>Push notifications (is device par)</b>
            <span className="muted small">{!pushSupported() ? 'Is browser mein supported nahi' : pushOn ? `On · ${integ?.push.devices || 1} device(s)` : 'Phone par: browser menu → "Add to Home Screen", phir yahan on karein'}</span>
          </div>
          <button className={`btn ${pushOn ? '' : 'primary'} sm`} disabled={!pushSupported() || !integ || busy === 'push'} onClick={togglePush}>{pushOn ? 'Turn off' : 'Enable'}</button>
        </div>

        <div className="integ">
          <div className="integ-icon tg"><TelegramLogo size={22} weight="fill" /></div>
          <div className="integ-body">
            <b>Telegram</b>
            <span className="muted small">
              {!integ?.telegram.enabled ? 'Server par TELEGRAM_BOT_TOKEN set nahi (README dekhein)'
                : integ.telegram.linked ? `Connected ✓ @${integ.telegram.bot} — reminders + agent chat` : 'Reminders + buttons, aur agent se chat'}
            </span>
          </div>
          {integ?.telegram.enabled && (integ.telegram.linked
            ? <button className="btn sm" onClick={() => run('tg', api.telegramUnlink, 'Telegram disconnected')}>Disconnect</button>
            : <a className="btn primary sm" href={integ.telegram.link} target="_blank" rel="noreferrer" onClick={() => setTimeout(loadInteg, 8000)}><LinkSimple size={15} /> Connect</a>)}
        </div>

        <div className="integ">
          <div className="integ-icon wa"><WhatsappLogo size={22} weight="fill" /></div>
          <div className="integ-body">
            <b>WhatsApp</b>
            <span className="muted small">{integ?.whatsapp.enabled ? 'Number daalein (country code ke saath, e.g. +923001234567)' : 'Server par Twilio keys set nahi (README dekhein)'}</span>
            {integ?.whatsapp.enabled && (
              <div className="row mt8">
                <input className="input" placeholder="+923001234567" value={s.whatsappNumber || ''} onChange={(e) => set('whatsappNumber', e.target.value)} />
                <button className="btn sm" onClick={() => save()}>Save</button>
                {integ.whatsapp.number && <button className="btn sm" disabled={busy === 'wa'} onClick={() => run('wa', api.whatsappTest, 'Test message bhej diya ✓')}>Test</button>}
              </div>
            )}
          </div>
        </div>

        <div className="row mt8">
          <button className="btn ghost sm" onClick={onTestReminder}><Bell size={15} /> In-app test</button>
          <button className="btn ghost sm" disabled={busy === 'test'} onClick={() => run('test', api.testNotify, (r) => `Bheja: push ${r.push}, Telegram ${r.telegram ? '✓' : '–'}, WhatsApp ${r.whatsapp ? '✓' : '–'}`)}><BellRinging size={15} /> Test all channels</button>
        </div>
      </div>

      {/* Routine */}
      <div className="card form-card">
        <h3><SunHorizon size={18} /> Daily routine</h3>
        <label className="toggle"><input type="checkbox" checked={!!s.briefingEnabled} onChange={(e) => set('briefingEnabled', e.target.checked)} /><span /> Morning briefing</label>
        <div className="grid-2">
          <label className="field"><span><SunHorizon size={14} /> Briefing time</span><input type="time" value={s.briefingTime || '08:00'} onChange={(e) => set('briefingTime', e.target.value)} /></label>
          <label className="field"><span><Moon size={14} /> Daily review time</span><input type="time" value={s.reviewTime || '21:00'} onChange={(e) => set('reviewTime', e.target.value)} /></label>
          <label className="field"><span><Timer size={14} /> Follow-up after (min)</span><input type="number" min={5} max={240} value={s.followUpMinutes ?? 30} onChange={(e) => set('followUpMinutes', Number(e.target.value))} /></label>
          <label className="field"><span><Target size={14} /> Focus / break (min)</span>
            <div className="row nowrap">
              <input type="number" min={5} max={120} value={s.focusMinutes ?? 25} onChange={(e) => set('focusMinutes', Number(e.target.value))} />
              <input type="number" min={1} max={60} value={s.breakMinutes ?? 5} onChange={(e) => set('breakMinutes', Number(e.target.value))} />
            </div>
          </label>
        </div>
        <label className="toggle"><input type="checkbox" checked={!!s.weeklyReport} onChange={(e) => set('weeklyReport', e.target.checked)} /><span /> <ChartBar size={15} /> Sunday ko weekly report bhejein</label>
      </div>

      {/* Calendar */}
      <div className="card">
        <h3><GoogleLogo size={18} weight="bold" /> Google Calendar sync</h3>
        <p className="muted small"><b>Import:</b> Google Calendar → Settings → apna calendar → "Secret address in iCal format" copy karke yahan paste karein. Har 15 minute mein meetings khud tasks ban jayengi.</p>
        <div className="row">
          <input className="input grow" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" value={s.icsUrl || ''} onChange={(e) => set('icsUrl', e.target.value)} />
          <button className="btn sm" onClick={() => save()}>Save</button>
          <button className="btn sm" disabled={!integ?.calendar.icsUrl || busy === 'cal'} onClick={() => run('cal', api.calendarSync, (r) => `Synced ✓ ${r.imported} naye events`)}><ArrowsClockwise size={15} /> Sync now</button>
        </div>
        {integ?.calendar.error && <p className="warn small mt8">⚠ {integ.calendar.error}</p>}
        {integ?.calendar.lastSync && !integ.calendar.error && <p className="muted small mt8">Last sync: {new Date(integ.calendar.lastSync).toLocaleString()}</p>}
        <p className="muted small mt16"><b>Export:</b> Google Calendar → "Other calendars" → "+" → "From URL" mein yeh link daalein, taake aap ke DayMate tasks Google Calendar mein dikhein. (App online deployed honi chahiye.)</p>
        <div className="row">
          <input className="input grow mono" readOnly value={feedUrl} />
          <button className="btn sm" onClick={() => copy(feedUrl)}><Copy size={15} /> Copy</button>
        </div>
      </div>

      {/* Agent memory */}
      <div className="card">
        <h3><Brain size={18} /> Agent memory</h3>
        <p className="muted small">Agent aap ki routine yaad rakhta hai taake planning behtar ho. Agent khud bhi yahan cheezein add karta hai.</p>
        <div className="memory-list">
          {memory.length === 0 && <div className="muted small">Abhi kuch yaad nahi. Example: "Office 9 se 5 hai", "Gym shaam ko jata hoon"</div>}
          {memory.map((m) => (
            <div key={m.id} className="memory">
              <Brain size={15} />
              <span>{m.text}</span>
              <button className="icon-btn danger" onClick={() => api.deleteMemory(m.id).then(() => setMemory((x) => x.filter((y) => y.id !== m.id)))}><Trash size={15} /></button>
            </div>
          ))}
        </div>
        <form className="row mt8" onSubmit={(e) => { e.preventDefault(); if (newMem.trim()) api.addMemory(newMem).then((m) => { setMemory((x) => [...x.filter((y) => y.id !== m.id), m]); setNewMem(''); }); }}>
          <input className="input grow" placeholder="Agent ko kuch yaad karwayein…" value={newMem} onChange={(e) => setNewMem(e.target.value)} />
          <button className="btn sm"><Plus size={15} /> Add</button>
        </form>
      </div>

      {/* Preferences */}
      <div className="card form-card">
        <h3><User size={18} /> Preferences</h3>
        <div className="grid-2">
          <label className="field"><span><User size={14} /> Aapka naam</span><input value={s.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ahmed" /></label>
          <label className="field"><span><Microphone size={14} /> Voice language</span>
            <select value={s.voiceLang || 'en-IN'} onChange={(e) => set('voiceLang', e.target.value)}>
              <option value="en-IN">English / Hinglish (India)</option>
              <option value="en-US">English (US)</option>
              <option value="ur-PK">اردو Urdu (Pakistan)</option>
              <option value="hi-IN">Hindi</option>
            </select>
          </label>
        </div>
        <label className="toggle"><input type="checkbox" checked={!!s.sound} onChange={(e) => set('sound', e.target.checked)} /><span /> <SpeakerHigh size={15} /> Reminder sound</label>
        <label className="toggle"><input type="checkbox" checked={!!s.speakReplies} onChange={(e) => set('speakReplies', e.target.checked)} /><span /> <Robot size={15} /> Agent replies bol kar sunaye</label>
        <div className="row">
          <button className="btn primary" onClick={() => save()}>Save settings</button>
          {saved && <span className="ok"><CheckCircle size={17} weight="fill" /> Saved</span>}
        </div>
      </div>

      {/* Account */}
      <div className="card">
        <h3><User size={18} /> Account</h3>
        <div className="row-between">
          <div>
            <b>{user?.name || 'Account'}</b>
            <div className="muted small">{user?.email}</div>
            <div className="muted small mt8">
              AI: {health?.aiProviders?.length ? health.aiProviders.map((p) => `${p.label} (${p.model})`).join(' → ') : 'offline mode'} · Storage: {health?.db === 'mongo' ? 'MongoDB' : 'local file'}
            </div>
          </div>
          <button className="btn ghost danger" onClick={onLogout}><SignOut size={17} /> Logout</button>
        </div>
      </div>
    </div>
  );
}
