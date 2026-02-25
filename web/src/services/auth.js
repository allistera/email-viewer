// web/src/services/auth.js

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const authService = {
  // Login
  async login(username, password) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  },

  // Logout
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // Optional: reload or redirect
    window.location.href = '/login';
  },

  // Get Token
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  // Set Token
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  // Get User
  getUser() {
    const userStr = localStorage.getItem(USER_KEY);
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },

  // Set User
  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  // Is Authenticated
  isAuthenticated() {
    return !!this.getToken();
  }
};
