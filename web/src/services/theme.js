export const getTodoistToken = () => localStorage.getItem('todoist_token');
export const setTodoistToken = (token) => localStorage.setItem('todoist_token', token);
export const clearTodoistToken = () => localStorage.removeItem('todoist_token');

export const getPreference = () => localStorage.getItem('theme_preference') || 'system';
export const setPreference = (pref) => {
  localStorage.setItem('theme_preference', pref);
  applyTheme(pref);
};

export const applyTheme = (pref) => {
  const root = document.documentElement;
  if (pref === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (pref === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }
};

export const init = () => {
  const pref = getPreference();
  applyTheme(pref);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getPreference() === 'system') applyTheme('system');
  });
};
