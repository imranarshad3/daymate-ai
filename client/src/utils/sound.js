let ctx;

export function chime(kind = 'due') {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const notes = kind === 'pre' ? [660, 880] : kind === 'focus' ? [523, 659, 784, 1047] : [784, 988, 1175, 988, 1175];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch { /* audio not available */ }
}

export function systemNotify(title, body, tag, sticky = false) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    // When push is enabled on this device, the server sends notifications — avoid duplicates
    if (localStorage.getItem('daymate-push') === '1' && tag !== 'test' && tag !== 'focus') return;
    const n = new Notification(title, { body, tag, requireInteraction: sticky, icon: '/icons/icon-192.png', vibrate: [400, 150, 400], renotify: true });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* ignore */ }
}

export function speak(text, lang, onEnd) {
  try {
    if (!('speechSynthesis' in window)) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_`#>]/g, '').replace(/\p{Extended_Pictographic}/gu, '').replace(/^\s*-\s+/gm, '');
    const u = new SpeechSynthesisUtterance(clean);
    if (lang) u.lang = lang;
    u.rate = 1.03;
    if (onEnd) u.onend = () => onEnd();
    window.speechSynthesis.speak(u);
  } catch { onEnd?.(); }
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}
