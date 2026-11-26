import { useCallback, useEffect, useRef, useState } from 'react';
import { dueDate, fmtTime } from '../utils/date.js';
import { chime, systemNotify } from '../utils/sound.js';
import { vibrate } from '../utils/haptics.js';

/**
 * Reminder engine (runs every 10s in the browser):
 *  stage 0 -> 1 : heads-up X minutes before (toast + notification)
 *  stage 1 -> 2 : due now (popup modal + sound + notification)
 *  stage 2 -> 3 : follow-up after N minutes: "Kya aap ne yeh kar liya?"
 * Snooze sets snoozeUntil + stage 1, so the "due" alert fires again later.
 */
export function useReminders(tasks, { settings, onStage, onToast }) {
  const [alerts, setAlerts] = useState([]);
  const fired = useRef(new Set());
  const tasksRef = useRef(tasks);
  const optsRef = useRef({ settings, onStage, onToast });
  tasksRef.current = tasks;
  optsRef.current = { settings, onStage, onToast };

  const tickRef = useRef(() => {});

  useEffect(() => {
    const tick = () => {
      const { settings: s, onStage: stage, onToast: toast } = optsRef.current;
      if (!s) return;
      const now = Date.now();
      const followMs = (s.followUpMinutes || 30) * 60000;

      for (const t of tasksRef.current) {
        if (t.status !== 'pending' || !t.time) continue;
        const due = dueDate(t).getTime();
        const eff = t.snoozeUntil ? new Date(t.snoozeUntil).getTime() : due;
        if (now - eff > 12 * 3600000) continue; // too old, don't spam
        const st = t.reminderStage || 0;

        let kind = null;
        let next = st;
        if (st < 1 && t.remindBefore > 0 && now >= due - t.remindBefore * 60000 && now < due) {
          kind = 'pre'; next = 1;
        } else if (st < 2 && now >= eff) {
          kind = 'due'; next = 2;
        } else if (st === 2 && now >= eff + followMs) {
          kind = 'followup'; next = 3;
        }
        if (!kind) continue;

        const key = `${t.id}:${kind}:${t.snoozeUntil || ''}:${t.date}T${t.time}`;
        if (fired.current.has(key)) continue;
        fired.current.add(key);
        stage(t.id, { reminderStage: next });

        if (kind === 'pre') {
          toast(`⏰ ${t.remindBefore} min mein: ${t.title} (${fmtTime(t.time)})`, 'info');
          systemNotify(`Coming up: ${t.title}`, `${fmtTime(t.time)} — ${t.remindBefore} minute baqi hain`, key);
          if (s.sound) chime('pre');
          vibrate('pre', s.vibration);
        } else {
          const title = kind === 'due' ? `⏰ Time ho gaya: ${t.title}` : `🤔 Kya aap ne "${t.title}" kar liya?`;
          systemNotify(title, kind === 'due' ? `${fmtTime(t.time)} — abhi karna hai` : 'Done mark karein ya reschedule karein', key, true);
          if (s.sound) chime('due');
          vibrate(kind, s.vibration);
          setAlerts((a) => (a.some((x) => x.task.id === t.id) ? a.map((x) => (x.task.id === t.id ? { key, kind, task: t } : x)) : [...a, { key, kind, task: t }]));
        }
      }
    };
    tickRef.current = tick;
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  // Check immediately once settings / tasks arrive (no 10s wait)
  useEffect(() => {
    tickRef.current();
  }, [settings, tasks]);

  // Title flash while alerts are waiting
  useEffect(() => {
    if (!alerts.length) return undefined;
    const orig = document.title;
    let on = false;
    const id = setInterval(() => {
      on = !on;
      document.title = on ? `🔔 ${alerts[0].task.title}` : orig;
    }, 1000);
    return () => {
      clearInterval(id);
      document.title = orig;
    };
  }, [alerts]);

  const dismiss = useCallback((key) => setAlerts((a) => a.filter((x) => x.key !== key)), []);
  const test = useCallback((task) => {
    if (optsRef.current.settings?.sound) chime('due');
    vibrate('due', optsRef.current.settings?.vibration);
    systemNotify(`⏰ Test: ${task.title}`, 'Reminders kaam kar rahe hain ✅', 'test');
    setAlerts((a) => [...a, { key: `test-${Date.now()}`, kind: 'due', task, test: true }]);
  }, []);

  return { alerts, dismiss, test };
}
