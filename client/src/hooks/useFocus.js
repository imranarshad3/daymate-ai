import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { chime, systemNotify } from '../utils/sound.js';
import { todayStr } from '../utils/date.js';
import { vibrate } from '../utils/haptics.js';

const KEY = 'daymate-focus';
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
};

/** Pomodoro engine. State survives reloads (stored in localStorage). */
export function useFocus(settings, { onLogged, onToast } = {}) {
  const [s, setS] = useState(load); // { taskId, title, mode, duration, endsAt, remaining, running, round }
  const [, force] = useState(0);
  const sRef = useRef(s);
  sRef.current = s;
  const focusMin = settings?.focusMinutes || 25;
  const breakMin = settings?.breakMinutes || 5;

  const save = useCallback((next) => {
    setS(next);
    try { next ? localStorage.setItem(KEY, JSON.stringify(next)) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);

  const remaining = s ? (s.running ? Math.max(0, Math.round((s.endsAt - Date.now()) / 1000)) : s.remaining) : 0;

  const start = useCallback((task) => {
    const duration = focusMin * 60;
    save({ taskId: task?.id || null, title: task?.title || 'Deep work', mode: 'focus', duration, endsAt: Date.now() + duration * 1000, remaining: duration, running: true, round: 1 });
    chime('pre');
  }, [focusMin, save]);

  const pause = useCallback(() => {
    const c = sRef.current;
    if (!c?.running) return;
    save({ ...c, running: false, remaining: Math.max(0, Math.round((c.endsAt - Date.now()) / 1000)), endsAt: null });
  }, [save]);

  const resume = useCallback(() => {
    const c = sRef.current;
    if (!c || c.running) return;
    save({ ...c, running: true, endsAt: Date.now() + c.remaining * 1000 });
  }, [save]);

  const finishFocus = useCallback(async (c, early = false) => {
    const minutes = Math.round((c.duration - (early ? Math.max(0, Math.round((c.endsAt - Date.now()) / 1000)) : 0)) / 60);
    if (minutes >= 1) {
      try {
        await api.logFocus({ taskId: c.taskId, title: c.title, minutes, date: todayStr() });
        onLogged?.();
      } catch { /* offline */ }
    }
    return minutes;
  }, [onLogged]);

  const stop = useCallback(async () => {
    const c = sRef.current;
    if (c?.mode === 'focus' && c.running) {
      const m = await finishFocus(c, true);
      if (m >= 1) onToast?.(`Focus session saved · ${m} min`, 'info');
    }
    save(null);
  }, [finishFocus, save, onToast]);

  const skip = useCallback(() => {
    const c = sRef.current;
    if (!c) return;
    if (c.mode === 'break') save({ ...c, mode: 'focus', duration: focusMin * 60, remaining: focusMin * 60, endsAt: Date.now() + focusMin * 60000, running: true, round: (c.round || 1) + 1 });
    else stop();
  }, [save, stop, focusMin]);

  // ticker
  useEffect(() => {
    const id = setInterval(async () => {
      const c = sRef.current;
      if (!c?.running) return;
      if (Date.now() < c.endsAt) { force((x) => x + 1); return; }
      if (c.mode === 'focus') {
        save({ ...c, running: false, remaining: 0, endsAt: null, completing: true });
        const m = await finishFocus(c);
        chime('focus');
        vibrate('focus', settings?.vibration);
        systemNotify('🎯 Focus session complete!', `${m} min · ${c.title}. Ab ${breakMin} min ka break lein.`, 'focus');
        onToast?.(`🎯 ${m} min focus complete! Break time`, 'success');
        const dur = breakMin * 60;
        save({ ...c, mode: 'break', duration: dur, endsAt: Date.now() + dur * 1000, remaining: dur, running: true, completing: false });
      } else {
        chime('pre');
        vibrate('pre', settings?.vibration);
        systemNotify('☕ Break khatam', `Agla focus round shuru karein: ${c.title}`, 'focus');
        save({ ...c, mode: 'focus', duration: focusMin * 60, remaining: focusMin * 60, endsAt: null, running: false, round: (c.round || 1) + 1 });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [save, finishFocus, breakMin, focusMin, onToast, settings?.vibration]);

  return { state: s, remaining, start, pause, resume, stop, skip, focusMin, breakMin };
}

export const fmtClock = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
