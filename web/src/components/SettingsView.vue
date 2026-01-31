<template>
  <section class="settings-view">
    <header class="settings-header">
      <div class="header-left">
        <button class="back-btn" type="button" @click="$emit('close')" aria-label="Back to Inbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="back-icon">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div>
          <h2>Settings</h2>
          <p class="subtitle">Manage integrations for your inbox.</p>
        </div>
      </div>
      <button class="btn-secondary desktop-back-btn" type="button" @click="$emit('close')">
        Back to Inbox
      </button>
    </header>

    <div class="settings-card">
      <h3>Todoist</h3>
      <label class="field-label" for="todoist-token">Todoist API token</label>
      <div class="input-row">
        <input
          id="todoist-token"
          v-model.trim="todoistToken"
          :type="showToken ? 'text' : 'password'"
          placeholder="Paste your Todoist API token"
          autocomplete="off"
        />
        <button class="btn-secondary" type="button" @click="toggleShow">
          {{ showToken ? 'Hide' : 'Show' }}
        </button>
      </div>
      <p class="field-help">
        Stored locally in your browser. This token is sent with Todoist requests.
      </p>
      <div class="actions">
        <button class="btn-primary" type="button" :disabled="saving" @click="handleSave">
          {{ saving ? 'Saving...' : 'Save token' }}
        </button>
        <button class="btn-secondary" type="button" :disabled="!hasSavedToken" @click="handleClear">
          Clear
        </button>
      </div>
      <p v-if="statusMessage" class="status" :class="{ error: statusType === 'error' }">
        {{ statusMessage }}
      </p>
    </div>
  </section>
</template>

<script>
import { getTodoistToken, setTodoistToken, clearTodoistToken } from '../services/auth.js';

export default {
  name: 'SettingsView',
  emits: ['close'],
  data() {
    return {
      todoistToken: '',
      showToken: false,
      saving: false,
      hasSavedToken: false,
      statusMessage: '',
      statusType: 'success'
    };
  },
  mounted() {
    this.loadToken();
  },
  methods: {
    loadToken() {
      const token = getTodoistToken() || '';
      this.todoistToken = token;
      this.hasSavedToken = Boolean(token);
    },
    toggleShow() {
      this.showToken = !this.showToken;
    },
    async handleSave() {
      const trimmed = (this.todoistToken || '').trim();
      if (!trimmed) {
        this.setStatus('Todoist token cannot be empty.', 'error');
        return;
      }
      this.saving = true;
      try {
        setTodoistToken(trimmed);
        this.hasSavedToken = true;
        this.setStatus('Todoist token saved.', 'success');
      } finally {
        this.saving = false;
      }
    },
    handleClear() {
      clearTodoistToken();
      this.todoistToken = '';
      this.hasSavedToken = false;
      this.setStatus('Todoist token cleared.', 'success');
    },
    setStatus(message, type) {
      this.statusMessage = message;
      this.statusType = type;
    }
  }
};
</script>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 20px;
  height: 100%;
  overflow: auto;
  background: var(--color-bg);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.settings-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  color: var(--color-text);
}

.subtitle {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.settings-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  max-width: 520px;
  background: var(--color-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.settings-card h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: var(--color-text);
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.input-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.input-row input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  font-size: 14px;
}

.input-row input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.field-help {
  margin: 8px 0 16px 0;
  font-size: 12.5px;
  color: var(--color-text-secondary);
}

.actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-primary,
.btn-secondary {
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.btn-secondary {
  background: var(--color-bg);
  color: var(--color-text);
  border-color: var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status {
  margin-top: 12px;
  font-size: 13px;
  color: var(--color-success);
}

.status.error {
  color: var(--color-primary);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text);
}

.back-btn:hover {
  background: var(--color-bg-secondary);
}

.back-icon {
  width: 24px;
  height: 24px;
}

/* Mobile settings styles */
@media (max-width: 768px) {
  .settings-view {
    padding: 16px;
  }

  .settings-header {
    flex-direction: row;
    justify-content: flex-start;
  }

  .back-btn {
    display: flex;
  }

  .desktop-back-btn {
    display: none;
  }

  .settings-header h2 {
    font-size: 18px;
  }

  .settings-card {
    max-width: 100%;
  }

  .input-row {
    flex-direction: column;
  }

  .input-row input {
    width: 100%;
  }

  .input-row button {
    width: 100%;
  }

  .actions {
    flex-direction: column;
  }

  .actions button {
    width: 100%;
  }
}
</style>
