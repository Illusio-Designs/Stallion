// Theme choice: 'light' | 'dark' | 'system'. Saved on the device; applied to <html data-theme>.
export const THEME_KEY = 'stl-theme';

export const getThemeChoice = () => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch (_e) { return 'system'; }
};

export const resolveTheme = (choice) => {
  if (choice === 'light' || choice === 'dark') return choice;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyTheme = (choice) => {
  const theme = resolveTheme(choice);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"][data-live]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0b0c' : '#ffffff');
};

export const setThemeChoice = (choice) => {
  try { localStorage.setItem(THEME_KEY, choice); } catch (_e) { /* storage blocked: applies for this visit only */ }
  applyTheme(choice);
  window.dispatchEvent(new CustomEvent('stl-theme-change', { detail: choice }));
};
