// Vibration / haptic feedback (Android Chrome & installed PWA. iPhone browsers don't expose vibration.)
export const VIBRATION_LEVELS = {
  off: null,
  gentle: { pre: [80], due: [150, 100, 150], followup: [120, 80, 120], tap: [12], focus: [100, 60, 100] },
  normal: { pre: [150, 80, 150], due: [400, 150, 400, 150, 400], followup: [250, 120, 250], tap: [18], focus: [200, 100, 200, 100, 400] },
  strong: { pre: [300, 120, 300], due: [800, 200, 800, 200, 800, 200, 800], followup: [500, 150, 500, 150, 500], tap: [30], focus: [400, 150, 400, 150, 800] },
};

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function vibrate(kind, level = 'normal') {
  try {
    const set = VIBRATION_LEVELS[level];
    if (!set || !canVibrate()) return false;
    return navigator.vibrate(set[kind] || set.tap);
  } catch {
    return false;
  }
}

export function stopVibration() {
  try { if (canVibrate()) navigator.vibrate(0); } catch { /* ignore */ }
}

export function platform() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  return { ios, android, mobile: ios || android || window.innerWidth < 760, standalone };
}
