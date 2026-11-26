import { useEffect, useState } from 'react';
import { BellRinging, DeviceMobile, X, Export, PlusSquare, Vibrate, Lock, CircleNotch } from '@phosphor-icons/react';
import { api } from '../api.js';
import { enablePush, pushSupported, pushOnThisDevice } from '../utils/push.js';
import { platform, vibrate } from '../utils/haptics.js';

const HIDE_KEY = 'daymate-notify-prompt-hidden';

/** Bottom sheet that asks for notification permission on phones (and desktops) with clear per-platform steps. */
export default function NotifyPrompt({ settings, toast, force = false, onDone }) {
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [hidden, setHidden] = useState(() => !force && localStorage.getItem(HIDE_KEY) === '1');
  const [busy, setBusy] = useState(false);
  const p = platform();

  useEffect(() => {
    // Permission can change from browser settings while the app is open
    let status;
    navigator.permissions?.query({ name: 'notifications' }).then((s) => {
      status = s;
      s.onchange = () => setPerm(s.state === 'prompt' ? 'default' : s.state);
    }).catch(() => {});
    return () => { if (status) status.onchange = null; };
  }, []);

  const needsInstall = p.ios && !p.standalone; // iOS only allows web push from a Home Screen app
  const done = perm === 'granted' && (pushOnThisDevice() || !pushSupported());
  if (hidden || (done && !force)) return null;

  const close = () => {
    localStorage.setItem(HIDE_KEY, '1');
    setHidden(true);
    onDone?.();
  };

  async function allow() {
    setBusy(true);
    try {
      const { push } = await api.integrations();
      await enablePush(push.publicKey);
      setPerm('granted');
      vibrate('due', settings?.vibration || 'normal');
      new Notification('✅ DayMate notifications on', { body: 'Ab reminders isi tarah aayenge — vibration ke saath.', icon: '/icons/icon-192.png', vibrate: [200, 100, 200] });
      toast('Notifications + vibration on ✓');
      close();
    } catch (e) {
      const now = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
      setPerm(now);
      if (now === 'granted') {
        // Permission OK but push service unavailable (e.g. http on phone) -> in-app notifications still work
        toast('Notifications on ✓ (background push ke liye app ko HTTPS par deploy karein)', 'info');
        vibrate('due', settings?.vibration || 'normal');
        close();
      } else if (now === 'denied') {
        toast('Permission block ho gayi — neeche steps se on karein', 'error');
      } else toast(e.message, 'error');
    }
    setBusy(false);
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet">
        <button className="icon-btn sheet-close" onClick={close}><X size={18} /></button>
        <div className="sheet-icon"><BellRinging size={34} weight="fill" /></div>
        <h3>Reminders miss na hon</h3>
        <p className="muted">Notification access dein taake waqt par phone par alert aaye, vibration ke saath, chahe app band ho.</p>

        <div className="sheet-perks">
          <span><BellRinging size={17} /> Waqt par alert</span>
          <span><Vibrate size={17} /> Vibration</span>
          <span><DeviceMobile size={17} /> Lock screen par</span>
        </div>

        {needsInstall ? (
          <div className="sheet-steps">
            <b>iPhone par pehle app install karein:</b>
            <ol>
              <li>Safari mein neeche <Export size={16} /> <b>Share</b> button dabayein</li>
              <li><PlusSquare size={16} /> <b>Add to Home Screen</b> chunein</li>
              <li>Home screen se <b>DayMate</b> kholein aur yahan "Allow" dabayein</li>
            </ol>
            <p className="muted small">Note: iPhone web apps ko vibration control nahi deta, sirf notification sound/haptic aata hai.</p>
          </div>
        ) : perm === 'denied' ? (
          <div className="sheet-steps">
            <b><Lock size={16} /> Notifications block hain. Aise on karein:</b>
            {p.android ? (
              <ol>
                <li>Address bar mein <b>🔒 lock icon</b> (ya ⋮ → Site settings) dabayein</li>
                <li><b>Notifications → Allow</b> karein</li>
                <li>Installed app ho to: Phone Settings → Apps → DayMate → Notifications → On</li>
                <li>Page reload karein</li>
              </ol>
            ) : (
              <ol>
                <li>Address bar mein <b>🔒 lock icon</b> par click karein</li>
                <li><b>Notifications → Allow</b> chunein</li>
                <li>Page reload karein</li>
              </ol>
            )}
          </div>
        ) : perm === 'unsupported' ? (
          <p className="muted small">Yeh browser notifications support nahi karta. Chrome (Android) ya Safari (iPhone, Home Screen app) use karein.</p>
        ) : (
          <>
            {p.android && !p.standalone && (
              <p className="muted small sheet-tip">Tip: behtareen experience ke liye Chrome menu ⋮ → <b>Install app / Add to Home screen</b> karein.</p>
            )}
            <button className="btn primary big" onClick={allow} disabled={busy}>
              {busy ? <CircleNotch size={18} className="spin" /> : <><BellRinging size={18} weight="fill" /> Allow notifications</>}
            </button>
          </>
        )}
        <button className="link" onClick={close}>Abhi nahi</button>
      </div>
    </div>
  );
}
