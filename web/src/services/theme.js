export const getTodoistToken = () => localStorage.getItem('todoist_token');
export const setTodoistToken = (token) => localStorage.setItem('todoist_token', token);
export const clearTodoistToken = () => localStorage.removeItem('todoist_token');

export const getPreference = () => localStorage.getItem('theme_preference') || 'system';
export const setPreference = (pref) => {
  localStorage.setItem('theme_preference', pref);
  applyTheme(pref);
};

export const init = () => {
  applyTheme(getPreference());
};

export const applyTheme = (pref) => {
  const root = document.documentElement;
  if (pref === 'dark') {
    root.classList.add('dark-mode');
  } else if (pref === 'light') {
    root.classList.remove('dark-mode');
  } else {
    // System
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) root.classList.add('dark-mode');
    else root.classList.remove('dark-mode');
  }
};
