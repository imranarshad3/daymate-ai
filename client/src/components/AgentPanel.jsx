import { useEffect, useRef, useState } from 'react';
import {
  Robot, PaperPlaneRight, Microphone, MicrophoneSlash, X, SpeakerHigh, SpeakerSlash, Trash, ClipboardText,
  CalendarPlus, Power, CircleNotch, Waveform, Lightning, Hourglass,
} from '@phosphor-icons/react';
import { api } from '../api.js';
import { fmtTime } from '../utils/date.js';
import { speak, stopSpeaking } from '../utils/sound.js';

const ACTION_LABEL = {
  added: 'Added', done: 'Done', missed: 'Not done', pending: 'Pending', moved: 'Moved', deleted: 'Deleted', review: '',
  subtasks: 'Checklist', habit: 'Habit done', 'habit-undo': 'Habit unchecked', 'habit-new': 'New habit', memory: 'Remembered', forgot: '',
};

function Rich({ text }) {
  const inline = (s, k) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <b key={`${k}-${i}`}>{p.slice(2, -2)}</b> : p));
  return (
    <>
      {text.split('\n').map((line, i) =>
        /^\s*[-•*]\s+/.test(line) ? <div key={i} className="md-li">{inline(line.replace(/^\s*[-•*]\s+/, ''), i)}</div>
          : line.trim() ? <p key={i}>{inline(line, i)}</p> : <div key={i} className="md-gap" />
      )}
    </>
  );
}

export default function AgentPanel({ open, onClose, kick, today, settings, aiOnline, aiLabel, onChanged, onSettings }) {
  const storageKey = `daymate-chat-${today}`;
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState('idle'); // idle | listening | thinking | speaking
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const listRef = useRef(null);
  const msgsRef = useRef(messages);
  const busyRef = useRef(false);
  const voiceRef = useRef(false);
  msgsRef.current = messages;
  voiceRef.current = voiceMode;

  useEffect(() => {
    try { setMessages(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { setMessages([]); }
  }, [storageKey]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-60))); } catch { /* full */ }
  }, [messages, storageKey]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text, kickoff) {
    if (busyRef.current) return null;
    busyRef.current = true;
    const history = msgsRef.current.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    const outgoing = text ? [...history, { role: 'user', content: text }] : history;
    if (text) setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    if (voiceRef.current) setVoiceState('thinking');
    try {
      const r = await api.agent({ messages: outgoing, kickoff });
      setMessages((m) => [...m, { role: 'assistant', content: r.reply, actions: r.actions || [] }]);
      if (r.actions?.length) onChanged();
      if (voiceRef.current) {
        setVoiceState('speaking');
        speak(r.reply, settings?.voiceLang, () => voiceRef.current && listen());
      } else if (settings?.speakReplies) speak(r.reply, settings.voiceLang);
      return r;
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${e.message}`, error: true }]);
      if (voiceRef.current) setVoiceState('idle');
      return null;
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    if (kick && open) send(null, kick.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kick]);

  useEffect(() => {
    if (open && !kick && msgsRef.current.length === 0) send(null, 'start');
    if (!open) exitVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Voice input is browser mein supported nahi. Chrome / Edge use karein.');
      setVoiceMode(false);
      return;
    }
    recRef.current?.abort?.();
    const rec = new SR();
    rec.lang = settings?.voiceLang || 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else tmp += e.results[i][0].transcript;
      }
      const full = (finalText + tmp).trim();
      setInterim(full);
      if (!voiceRef.current) setInput(full);
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
      if (finalText.trim()) send(finalText.trim());
      else if (voiceRef.current) setVoiceState('idle');
    };
    rec.onerror = () => {
      setListening(false);
      if (voiceRef.current) setVoiceState('idle');
    };
    recRef.current = rec;
    setListening(true);
    if (voiceRef.current) setVoiceState('listening');
    stopSpeaking();
    rec.start();
  }

  function toggleMic() {
    if (listening) recRef.current?.stop();
    else listen();
  }

  function enterVoice() {
    setVoiceMode(true);
    voiceRef.current = true;
    listen();
  }
  function exitVoice() {
    setVoiceMode(false);
    voiceRef.current = false;
    setVoiceState('idle');
    recRef.current?.abort?.();
    stopSpeaking();
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <aside className={`agent ${open ? 'open' : ''}`} aria-hidden={!open}>
      <header className="agent-head">
        <div className="agent-id">
          <div className={`agent-avatar ${loading ? 'thinking' : ''}`}><Robot size={22} weight="fill" /></div>
          <div>
            <div className="agent-name">DayMate Agent</div>
            <div className="agent-status"><span className={`dot ${aiOnline ? 'on' : 'warn'}`} /> {aiOnline ? `AI online${aiLabel ? ` · ${aiLabel}` : ''}` : 'Offline mode'}</div>
          </div>
        </div>
        <div className="agent-tools">
          <button className="icon-btn" title="Voice mode" onClick={enterVoice}><Waveform size={19} /></button>
          <button className="icon-btn" title={settings?.speakReplies ? 'Voice replies off' : 'Voice replies on'} onClick={() => onSettings({ speakReplies: !settings?.speakReplies })}>
            {settings?.speakReplies ? <SpeakerHigh size={19} /> : <SpeakerSlash size={19} />}
          </button>
          <button className="icon-btn" title="Clear chat" onClick={() => setMessages([])}><Trash size={19} /></button>
          <button className="icon-btn" title="Agent OFF" onClick={onClose}><Power size={19} /></button>
          <button className="icon-btn mobile-only" onClick={onClose}><X size={19} /></button>
        </div>
      </header>

      <div className="agent-msgs" ref={listRef}>
        {messages.length === 0 && !loading && (
          <div className="agent-empty">
            <Robot size={42} />
            <p>Mujhe batayein aaj kya kiya aur kal kya karna hai. Main todos set kar doonga aur waqt par yaad dilaunga.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role} ${m.error ? 'error' : ''}`}>
            <div className="bubble"><Rich text={m.content} /></div>
            {m.actions?.length > 0 && (
              <div className="msg-actions">
                {m.actions.map((a, j) => (
                  <span key={j} className={`act act-${a.type}`}>
                    {ACTION_LABEL[a.type] ?? a.type} <b>{a.title}</b>
                    {a.time ? ` · ${fmtTime(a.time)}` : ''}
                    {a.date && a.type !== 'review' && a.date !== today ? ` · ${a.date.slice(5)}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="msg assistant"><div className="bubble typing"><span /><span /><span /></div></div>}
      </div>

      <div className="agent-quick">
        <button className="chip" disabled={loading} onClick={() => send(null, 'review')}><ClipboardText size={15} /> Aaj ka review</button>
        <button className="chip" disabled={loading} onClick={() => send(null, 'plan')}><CalendarPlus size={15} /> Kal ki planning</button>
        <button className="chip" disabled={loading} onClick={() => send(null, 'optimize')}><Lightning size={15} /> Smart reschedule</button>
        <button className="chip" disabled={loading} onClick={() => send('Aaj ke baqi kaam kya hain?')}><Hourglass size={15} /> Baqi kaam?</button>
      </div>

      <form className="agent-input" onSubmit={(e) => { e.preventDefault(); if (input.trim()) send(input.trim()); }}>
        <button type="button" className={`icon-btn mic ${listening && !voiceMode ? 'live' : ''}`} onClick={toggleMic} title="Voice input">
          {listening && !voiceMode ? <MicrophoneSlash size={19} /> : <Microphone size={19} />}
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? 'Sun raha hoon…' : 'Likhein: "kal 10:30 Ali ko call"…'} />
        <button className="send" disabled={!input.trim() || loading}>{loading ? <CircleNotch size={18} className="spin" /> : <PaperPlaneRight size={18} weight="fill" />}</button>
      </form>

      {voiceMode && (
        <div className="voice-mode">
          <button className="icon-btn voice-close" onClick={exitVoice}><X size={22} /></button>
          <div className={`orb ${voiceState}`} onClick={() => (voiceState === 'listening' ? recRef.current?.stop() : listen())}>
            <div className="orb-core">{voiceState === 'thinking' ? <CircleNotch size={40} className="spin" /> : <Microphone size={40} weight="fill" />}</div>
          </div>
          <div className="voice-state">
            {voiceState === 'listening' && 'Sun raha hoon…'}
            {voiceState === 'thinking' && 'Soch raha hoon…'}
            {voiceState === 'speaking' && 'Bol raha hoon…'}
            {voiceState === 'idle' && 'Bolne ke liye orb par tap karein'}
          </div>
          <div className="voice-transcript">{interim || (lastAssistant && voiceState !== 'listening' ? lastAssistant.content.split('\n').slice(0, 4).join(' ') : '')}</div>
          <p className="voice-hint">Bas bolein: "kal subah 10 baje doctor appointment"</p>
        </div>
      )}
    </aside>
  );
}
