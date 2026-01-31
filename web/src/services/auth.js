/**
 * Authentication service
 */

const TOKEN_KEY = 'email_api_token';
const TODOIST_TOKEN_KEY = 'todoist_api_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasToken() {
  return !!getToken();
}

export function getTodoistToken() {
  return localStorage.getItem(TODOIST_TOKEN_KEY);
}

export function setTodoistToken(token) {
  localStorage.setItem(TODOIST_TOKEN_KEY, token);
}

export function clearTodoistToken() {
  localStorage.removeItem(TODOIST_TOKEN_KEY);
}

export function hasTodoistToken() {
  return !!getTodoistToken();
}
