<template>
  <div class="login-screen">
    <div class="login-container">
      <!-- Logo and branding -->
      <div class="login-header">
        <div class="logo">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
        </div>
        <h1 class="login-title">Welcome Back</h1>
        <p class="login-subtitle">Enter your password to continue</p>
      </div>

      <!-- Login form -->
      <form class="login-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <div class="password-input-wrapper">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              :class="{ 'input-error': error }"
              placeholder="Enter your password"
              :disabled="loading"
              autocomplete="current-password"
              @input="clearError"
            />
            <button
              type="button"
              class="toggle-password"
              @click="showPassword = !showPassword"
              :disabled="loading"
              aria-label="Toggle password visibility"
            >
              <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Error message -->
        <div v-if="error" class="error-message" role="alert">
          <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ error }}</span>
        </div>

        <!-- Rate limit message -->
        <div v-if="rateLimited" class="warning-message" role="alert">
          <svg class="warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Too many attempts. Please try again in {{ retryAfter }} seconds.</span>
        </div>

        <!-- Submit button -->
        <button
          type="submit"
          class="login-btn"
          :disabled="loading || !password || rateLimited"
        >
          <svg v-if="loading" class="spinner" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span v-if="loading">Logging in...</span>
          <span v-else>Continue</span>
        </button>
      </form>

      <!-- Security notice -->
      <div class="security-notice">
        <svg class="security-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Your connection is secure and encrypted</span>
      </div>
    </div>

    <!-- Background decoration -->
    <div class="bg-decoration">
      <div class="decoration-circle circle-1"></div>
      <div class="decoration-circle circle-2"></div>
      <div class="decoration-circle circle-3"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoginScreen',
  props: {
    errorMessage: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      password: '',
      showPassword: false,
      loading: false,
      error: this.errorMessage,
      rateLimited: false,
      retryAfter: 0
    };
  },
  watch: {
    errorMessage(val) {
      this.error = val;
    }
  },
  methods: {
    async handleSubmit() {
      this.error = '';
      this.loading = true;

      try {
        // Call auth API
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password: this.password
          })
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 429) {
            this.rateLimited = true;
            const retryAfterHeader = response.headers.get('Retry-After');
            this.retryAfter = parseInt(retryAfterHeader) || 900;
            this.startRetryCountdown();
          } else {
            this.error = data.error || 'Login failed. Please try again.';
          }
          return;
        }

        // Store tokens
        if (data.accessToken) {
          localStorage.setItem('auth_token', data.accessToken);
          if (data.csrfToken) {
            localStorage.setItem('csrf_token', data.csrfToken);
          }
        }

        // Emit success event
        this.$emit('submit', data.accessToken);

        // Clear password
        this.password = '';

      } catch (error) {
        this.error = 'Network error. Please check your connection.';
      } finally {
        this.loading = false;
      }
    },

    clearError() {
      this.error = '';
    },

    startRetryCountdown() {
      const interval = setInterval(() => {
        this.retryAfter--;
        if (this.retryAfter <= 0) {
          this.rateLimited = false;
          clearInterval(interval);
        }
      }, 1000);
    }
  }
};
</script>

<style scoped>
.login-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
}

.login-container {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 420px;
  padding: 48px;
  background: var(--color-bg);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.4s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.logo-icon {
  width: 64px;
  height: 64px;
  color: var(--color-primary);
  filter: drop-shadow(0 4px 12px rgba(88, 101, 242, 0.3));
}

.login-title {
  font-family: 'Lexend', 'Inter', sans-serif;
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 8px 0;
}

.login-subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.login-form {
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.password-input-wrapper {
  position: relative;
}

.form-input {
  width: 100%;
  height: 48px;
  padding: 0 44px 0 16px;
  background: var(--color-bg-secondary);
  border: 2px solid transparent;
  border-radius: 8px;
  color: var(--color-text);
  font-size: 15px;
  outline: none;
  transition: all 0.2s;
}

.form-input:focus {
  background: var(--color-bg);
  border-color: var(--color-primary);
}

.form-input.input-error {
  border-color: var(--color-danger);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-password {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s;
}

.toggle-password:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.toggle-password:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message,
.warning-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 20px;
}

.error-message {
  background: rgba(242, 63, 67, 0.1);
  color: var(--color-danger);
  border: 1px solid rgba(242, 63, 67, 0.2);
}

.warning-message {
  background: rgba(240, 178, 50, 0.1);
  color: var(--color-warning);
  border: 1px solid rgba(240, 178, 50, 0.2);
}

.error-icon,
.warning-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.login-btn {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.login-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(88, 101, 242, 0.4);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.spinner {
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.security-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.security-icon {
  width: 16px;
  height: 16px;
  color: var(--color-success);
}

/* Background decoration */
.bg-decoration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.decoration-circle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: float 20s ease-in-out infinite;
}

.circle-1 {
  width: 400px;
  height: 400px;
  top: -200px;
  right: -200px;
  animation-delay: 0s;
}

.circle-2 {
  width: 300px;
  height: 300px;
  bottom: -150px;
  left: -150px;
  animation-delay: -7s;
}

.circle-3 {
  width: 250px;
  height: 250px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -14s;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
}

@media (max-width: 640px) {
  .login-container {
    max-width: 90%;
    padding: 32px 24px;
  }

  .login-title {
    font-size: 24px;
  }
}
</style>
