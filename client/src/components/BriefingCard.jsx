import { useEffect, useState } from 'react';
import { SunHorizon, X, SpeakerHigh, ArrowsClockwise } from '@phosphor-icons/react';
import { api } from '../api.js';
import { speak } from '../utils/sound.js';

export default function BriefingCard({ today, settings, refreshKey }) {
  const [text, setText] = useState('');
  const [hidden, setHidden] = useState(() => localStorage.getItem(`daymate-brief-hide-${today}`) === '1');
  const [busy, setBusy] = useState(false);

  const hhmm = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  const show = settings?.briefingEnabled && hhmm >= (settings.briefingTime || '08:00') && hhmm < '17:00' && !hidden;

  useEffect(() => {
    if (show) api.briefing(today).then((r) => setText(r.text)).catch(() => {});
  }, [show, today, refreshKey]);

  if (!show || !text) return null;
  const close = () => { localStorage.setItem(`daymate-brief-hide-${today}`, '1'); setHidden(true); };
  const refresh = async () => { setBusy(true); try { setText((await api.briefing(today, true)).text); } catch { /* ignore */ } setBusy(false); };

  return (
    <div className="briefing">
      <div className="briefing-head">
        <div className="briefing-title"><SunHorizon size={20} weight="fill" /> Morning briefing</div>
        <div className="row nowrap">
          <button className="icon-btn" title="Suno" onClick={() => speak(text, settings?.voiceLang)}><SpeakerHigh size={17} /></button>
          <button className="icon-btn" title="Refresh" onClick={refresh}><ArrowsClockwise size={17} className={busy ? 'spin' : ''} /></button>
          <button className="icon-btn" title="Hide" onClick={close}><X size={17} /></button>
        </div>
      </div>
      <div className="briefing-text">
        {text.split('\n').map((l, i) => (l.trim().startsWith('- ') ? <div key={i} className="md-li">{l.trim().slice(2)}</div> : l.trim() ? <p key={i}>{l}</p> : <div key={i} className="md-gap" />))}
      </div>
    </div>
  );
}
