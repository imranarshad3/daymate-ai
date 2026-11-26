export const THEMES = [
  { id: 'mono', name: 'Midnight Sapphire', desc: 'Obsidian, blue & indigo', swatch: ['#04050a', '#4f8cff', '#7dd3fc'] },
  { id: 'mono-light', name: 'Porcelain', desc: 'White, ink & blue', swatch: ['#f6f7fb', '#3b6cf6', '#5b4ee6'] },
  { id: 'champagne', name: 'Champagne', desc: 'Obsidian & gold', swatch: ['#04050a', '#d9b76e', '#f3dfae'] },
  { id: 'aurora', name: 'Aurora', desc: 'Midnight violet', swatch: ['#0a0b14', '#8b7cf6', '#5ee0f0'] },
  { id: 'emerald', name: 'Emerald', desc: 'Forest & jade', swatch: ['#07110e', '#3ccf9a', '#c8f2dc'] },
  { id: 'rose', name: 'Rosé', desc: 'Plum & blush', swatch: ['#120b10', '#e98aa4', '#f6c9a8'] },
  { id: 'sapphire', name: 'Sapphire', desc: 'Navy & ice', swatch: ['#060a16', '#6f9bff', '#bfe3ff'] },
  { id: 'ivory', name: 'Ivory', desc: 'Light & bronze', swatch: ['#f6f2ea', '#a87b32', '#1c1a16'] },
];

export function applyTheme(id) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem('daymate-theme', id);
  } catch { /* ignore */ }
  const bg = THEMES.find((t) => t.id === id)?.swatch[0];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#04050a');
}

export function currentTheme() {
  return document.documentElement.dataset.theme || 'mono';
}
