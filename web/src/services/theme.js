/**
 * Theme service - system (OS) preference by default
 */

const STORAGE_KEY = 'theme-preference';

let preference = 'system';
let systemDark = false;
let mediaQuery = null;
let listeners = [];

function applyTheme() {
  const root = document.documentElement;
  const isDark = preference === 'system' ? systemDark : preference === 'dark';
  if (preference === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', preference);
  }
  listeners.forEach((fn) => fn({ preference, isDark }));
}

function handleSystemChange(event) {
  systemDark = event.matches;
  if (preference === 'system') {
    applyTheme();
  }
}

export function init() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    preference = stored;
  }

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemDark = mediaQuery.matches;
  applyTheme();

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleSystemChange);
  } else if (mediaQuery.addListener) {
    mediaQuery.addListener(handleSystemChange);
  }
}

export function getPreference() {
  return preference;
}

export function getIsDark() {
  return preference === 'system' ? systemDark : preference === 'dark';
}

export function setPreference(value) {
  if (value !== 'system' && value !== 'light' && value !== 'dark') return;
  preference = value;
  if (value === 'system') {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, value);
  }
  applyTheme();
}

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((f) => f !== fn);
  };
}
