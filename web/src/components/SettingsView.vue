<template>
  <section class="settings-view">
    <header class="settings-header">
      <div>
        <h2>Settings</h2>
        <p class="subtitle">Manage integrations and tagging rules for your inbox.</p>
      </div>
      <button class="btn-secondary" type="button" @click="$emit('close')">
        Back to Inbox
      </button>
    </header>

    <!-- Appearance Section -->
    <div class="settings-card">
      <h3>Appearance</h3>
      <label class="field-label">Theme</label>
      <p class="field-help">Automatic follows your system (OS) preference by default.</p>
      <div class="theme-options">
        <label class="theme-option">
          <input type="radio" v-model="themePreference" value="system" @change="handleThemeChange" />
          <span>Automatic (system)</span>
        </label>
        <label class="theme-option">
          <input type="radio" v-model="themePreference" value="light" @change="handleThemeChange" />
          <span>Light</span>
        </label>
        <label class="theme-option">
          <input type="radio" v-model="themePreference" value="dark" @change="handleThemeChange" />
          <span>Dark</span>
        </label>
      </div>
    </div>

    <!-- Retention Policy Section -->
    <div class="settings-card">
      <h3>Retention Policy</h3>
      <label class="field-label">Delete emails older than (days)</label>
      <div class="input-row">
        <input
          v-model.number="retentionDays"
          type="number"
          min="0"
          placeholder="0 (Disabled)"
          :disabled="loadingRetention || savingRetention"
        />
        <button class="btn-primary" type="button" :disabled="loadingRetention || savingRetention" @click="saveRetention">
          {{ savingRetention ? 'Saving...' : 'Save' }}
        </button>
      </div>
      <p class="field-help">
        Set to 0 to disable automatic deletion. Attachments are also deleted.
      </p>
      <p v-if="retentionSuccess" class="status">{{ retentionSuccess }}</p>
      <p v-if="retentionError" class="status error">{{ retentionError }}</p>
    </div>

    <!-- Tagging Rules Section -->
    <div class="settings-card">
      <div class="card-header">
        <h3>Tagging Rules</h3>
        <button class="btn-primary btn-small" type="button" @click="showRuleForm = true" v-if="!showRuleForm">
          Add Rule
        </button>
      </div>
      <p class="field-help">
        Create custom rules to automatically tag incoming emails. Rules take priority over AI classification.
      </p>

      <!-- Add/Edit Rule Form -->
      <div v-if="showRuleForm" class="rule-form">
        <h4>{{ editingRule ? 'Edit Rule' : 'New Rule' }}</h4>

        <label class="field-label" for="rule-name">Rule Name</label>
        <input
          id="rule-name"
          v-model.trim="ruleForm.name"
          type="text"
          placeholder="e.g., Newsletter from Company"
        />

        <div class="conditions-section">
          <label class="field-label">Match Conditions (all must match)</label>

          <div class="condition-row">
            <label for="match-from">From contains:</label>
            <input
              id="match-from"
              v-model.trim="ruleForm.matchFrom"
              type="text"
              placeholder="e.g., newsletter@company.com"
            />
          </div>

          <div class="condition-row">
            <label for="match-to">To contains:</label>
            <input
              id="match-to"
              v-model.trim="ruleForm.matchTo"
              type="text"
              placeholder="e.g., myalias@domain.com"
            />
          </div>

          <div class="condition-row">
            <label for="match-subject">Subject contains:</label>
            <input
              id="match-subject"
              v-model.trim="ruleForm.matchSubject"
              type="text"
              placeholder="e.g., Weekly Update"
            />
          </div>

          <div class="condition-row">
            <label for="match-body">Body contains:</label>
            <input
              id="match-body"
              v-model.trim="ruleForm.matchBody"
              type="text"
              placeholder="e.g., unsubscribe"
            />
          </div>
        </div>

        <div class="action-section">
          <label class="field-label" for="tag-select">Apply Tag</label>
          <p v-if="tagsLoadError" class="status error">{{ tagsLoadError }}</p>
          <select id="tag-select" v-model="ruleForm.tagName">
            <option value="">Select a tag...</option>
            <option v-for="tag in availableTags" :key="tag.id" :value="tag.name">
              {{ tag.name }}
            </option>
          </select>
        </div>

        <div class="priority-section">
          <label class="field-label" for="priority">Priority</label>
          <input
            id="priority"
            v-model.number="ruleForm.priority"
            type="number"
            min="0"
            max="100"
            step="1"
            placeholder="0"
          />
          <span class="priority-help">Higher priority rules are checked first</span>
        </div>

        <div class="enabled-section">
          <label class="checkbox-label">
            <input type="checkbox" v-model="ruleForm.isEnabled" />
            <span>Rule is enabled</span>
          </label>
        </div>

        <div class="form-actions">
          <button class="btn-primary" type="button" :disabled="!isRuleFormValid || savingRule" @click="saveRule">
            {{ savingRule ? 'Saving...' : (editingRule ? 'Update Rule' : 'Create Rule') }}
          </button>
          <button class="btn-secondary" type="button" @click="cancelRuleForm">
            Cancel
          </button>
        </div>

        <p v-if="ruleError" class="status error">{{ ruleError }}</p>
      </div>

      <!-- Rules List -->
      <div v-if="!showRuleForm" class="rules-list">
        <div v-if="loadingRules" class="loading">Loading rules...</div>
        <div v-else-if="rules.length === 0" class="empty-state">
          No tagging rules yet. Click "Add Rule" to create one.
        </div>
        <div v-else>
          <div v-for="rule in rules" :key="rule.id" class="rule-item" :class="{ disabled: !rule.is_enabled }">
            <div class="rule-info">
              <div class="rule-name">
                {{ rule.name }}
                <span v-if="!rule.is_enabled" class="disabled-badge">Disabled</span>
              </div>
              <div class="rule-conditions">
                <span v-if="rule.match_from" class="condition">From: {{ rule.match_from }}</span>
                <span v-if="rule.match_to" class="condition">To: {{ rule.match_to }}</span>
                <span v-if="rule.match_subject" class="condition">Subject: {{ rule.match_subject }}</span>
                <span v-if="rule.match_body" class="condition">Body: {{ rule.match_body }}</span>
              </div>
              <div class="rule-action">
                Tag: <strong>{{ rule.tag_name }}</strong>
                <span v-if="rule.priority > 0" class="priority-badge">Priority: {{ rule.priority }}</span>
              </div>
            </div>
            <div class="rule-actions">
              <button class="btn-icon" type="button" @click="editRule(rule)" title="Edit rule" aria-label="Edit rule">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="btn-icon btn-danger" type="button" @click="confirmDeleteRule(rule)" title="Delete rule" aria-label="Delete rule">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Push Notifications Section -->
    <div class="settings-card">
      <h3>Push Notifications</h3>
      <p class="field-help">
        Get iOS push notifications when new emails arrive via <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy</a> (free, open-source).
      </p>

      <div v-if="notifyLoading" class="loading">Checking notification status...</div>
      <div v-else-if="notifyStatus">
        <div class="notify-status">
          <div class="notify-status-row">
            <span class="notify-label">Status:</span>
            <span :class="['notify-badge', notifyStatus.configured ? 'badge-active' : 'badge-inactive']">
              {{ notifyStatus.configured ? 'Configured' : 'Not Configured' }}
            </span>
          </div>
          <div v-if="notifyStatus.provider" class="notify-status-row">
            <span class="notify-label">Provider:</span>
            <span class="notify-value">{{ notifyStatus.provider }}</span>
          </div>
          <div v-if="notifyStatus.details" class="notify-details">
            <div v-for="(value, key) in notifyStatus.details" :key="key" class="notify-status-row">
              <span class="notify-label">{{ formatDetailKey(key) }}:</span>
              <span class="notify-value">{{ value === true ? 'Yes' : value === false ? 'No' : (value || 'Not set') }}</span>
            </div>
          </div>
        </div>

        <div v-if="notifyStatus.configured" class="actions" style="margin-top: 12px;">
          <button class="btn-primary" type="button" :disabled="testingSend" @click="handleTestNotification">
            {{ testingSend ? 'Sending...' : 'Send Test Notification' }}
          </button>
        </div>
        <p v-if="notifyTestMessage" class="status" :class="{ error: notifyTestType === 'error' }">
          {{ notifyTestMessage }}
        </p>

        <div v-if="!notifyStatus.configured" class="notify-setup-help">
          <p class="field-help" style="margin-top: 16px; margin-bottom: 8px;">
            <strong>Quick setup:</strong>
          </p>
          <div class="notify-provider-list">
            <div class="notify-provider-option">
              Uses <strong>ntfy</strong> — free &amp; open-source. <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy.sh</a>
              <ol class="setup-steps">
                <li>Install the <strong>ntfy</strong> app from the App Store</li>
                <li>Subscribe to a unique topic (e.g. <code>my-email-inbox-abc123</code>)</li>
                <li>Set the <code>NTFY_TOPIC</code> environment variable to that topic name</li>
              </ol>
              <code>NTFY_TOPIC=your-topic</code>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="notifyError" class="status error">{{ notifyError }}</div>
    </div>

    <!-- Todoist Section -->
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

    <!-- Delete Confirmation Modal -->
    <div
      v-if="deleteConfirm"
      class="modal-overlay"
      @click.self="closeDeleteModal"
      @keydown.esc="closeDeleteModal"
      tabindex="-1"
    >
      <div class="modal">
        <h4>Delete Rule</h4>
        <p>Are you sure you want to delete "{{ deleteConfirm.name }}"?</p>
        <p v-if="deleteError" class="status error">{{ deleteError }}</p>
        <div class="modal-actions">
          <button class="btn-danger" type="button" @click="deleteRule">Delete</button>
          <button class="btn-secondary" type="button" @click="closeDeleteModal">Cancel</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { getTodoistToken, setTodoistToken, clearTodoistToken } from '../services/auth.js';
import { getTaggingRules, createTaggingRule, updateTaggingRule, deleteTaggingRule, getTags, getNotificationStatus, sendTestNotification, getSettings, updateSettings } from '../services/api.js';
import { getPreference, setPreference } from '../services/theme.js';

export default {
  name: 'SettingsView',
  emits: ['close'],
  data() {
    return {
      themePreference: getPreference(),
      // Retention Policy
      retentionDays: 0,
      loadingRetention: false,
      savingRetention: false,
      retentionError: '',
      retentionSuccess: '',

      // Todoist
      todoistToken: '',
      showToken: false,
      saving: false,
      hasSavedToken: false,
      statusMessage: '',
      statusType: 'success',

      // Notifications
      notifyLoading: false,
      notifyStatus: null,
      notifyError: '',
      testingSend: false,
      notifyTestMessage: '',
      notifyTestType: 'success',

      // Tagging Rules
      rules: [],
      availableTags: [],
      loadingRules: true,
      showRuleForm: false,
      editingRule: null,
      savingRule: false,
      ruleError: '',
      deleteConfirm: null,
      deleteError: '',
      tagsLoadError: '',
      ruleForm: {
        name: '',
        matchFrom: '',
        matchTo: '',
        matchSubject: '',
        matchBody: '',
        tagName: '',
        priority: 0,
        isEnabled: true
      }
    };
  },
  computed: {
    isRuleFormValid() {
      const hasName = this.ruleForm.name.length > 0;
      const hasTag = this.ruleForm.tagName.length > 0;
      const hasCondition = this.ruleForm.matchFrom || this.ruleForm.matchTo ||
                          this.ruleForm.matchSubject || this.ruleForm.matchBody;
      return hasName && hasTag && hasCondition;
    }
  },
  mounted() {
    this.themePreference = getPreference();
    this.loadToken();
    this.loadRules();
    this.loadTags();
    this.loadNotificationStatus();
    this.loadRetention();
  },
  methods: {
    handleThemeChange() {
      setPreference(this.themePreference);
    },
    // Retention methods
    async loadRetention() {
      this.loadingRetention = true;
      try {
        const settings = await getSettings();
        this.retentionDays = settings.retention_days || 0;
      } catch (e) {
        console.error('Failed to load retention settings:', e);
        // Fallback to 0 if failed
      } finally {
        this.loadingRetention = false;
      }
    },
    async saveRetention() {
      this.savingRetention = true;
      this.retentionError = '';
      this.retentionSuccess = '';
      try {
        await updateSettings({ retention_days: this.retentionDays });
        this.retentionSuccess = 'Retention policy updated.';
      } catch (e) {
        this.retentionError = e.message || 'Failed to update retention policy.';
      } finally {
        this.savingRetention = false;
      }
    },

    // Notification methods
    async loadNotificationStatus() {
      this.notifyLoading = true;
      this.notifyError = '';
      try {
        this.notifyStatus = await getNotificationStatus();
      } catch (e) {
        console.error('Failed to load notification status:', e);
        this.notifyError = 'Failed to check notification status.';
      } finally {
        this.notifyLoading = false;
      }
    },
    async handleTestNotification() {
      this.testingSend = true;
      this.notifyTestMessage = '';
      try {
        const result = await sendTestNotification();
        if (result.ok) {
          this.notifyTestMessage = `Test notification sent via ${result.provider}. Check your phone!`;
          this.notifyTestType = 'success';
        } else {
          this.notifyTestMessage = result.error || 'Failed to send test notification.';
          this.notifyTestType = 'error';
        }
      } catch (e) {
        this.notifyTestMessage = e.message || 'Failed to send test notification.';
        this.notifyTestType = 'error';
      } finally {
        this.testingSend = false;
      }
    },
    formatDetailKey(key) {
      return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .replace(/^Has /, '')
        .replace(/^Is /, '');
    },
    // Todoist methods
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
    },

    // Tagging Rules methods
    async loadRules() {
      this.loadingRules = true;
      try {
        this.rules = await getTaggingRules();
      } catch (e) {
        console.error('Failed to load tagging rules:', e);
      } finally {
        this.loadingRules = false;
      }
    },
    async loadTags() {
      this.tagsLoadError = '';
      try {
        this.availableTags = await getTags();
      } catch (e) {
        console.error('Failed to load tags:', e);
        this.tagsLoadError = 'Failed to load tags. Please try again.';
      }
    },
    resetRuleForm() {
      this.ruleForm = {
        name: '',
        matchFrom: '',
        matchTo: '',
        matchSubject: '',
        matchBody: '',
        tagName: '',
        priority: 0,
        isEnabled: true
      };
      this.editingRule = null;
      this.ruleError = '';
    },
    cancelRuleForm() {
      this.showRuleForm = false;
      this.resetRuleForm();
    },
    editRule(rule) {
      this.editingRule = rule;
      this.ruleForm = {
        name: rule.name,
        matchFrom: rule.match_from || '',
        matchTo: rule.match_to || '',
        matchSubject: rule.match_subject || '',
        matchBody: rule.match_body || '',
        tagName: rule.tag_name,
        priority: rule.priority || 0,
        isEnabled: Boolean(rule.is_enabled)
      };
      this.showRuleForm = true;
      this.ruleError = '';
    },
    async saveRule() {
      if (!this.isRuleFormValid) return;

      this.savingRule = true;
      this.ruleError = '';

      try {
        if (this.editingRule) {
          await updateTaggingRule(this.editingRule.id, this.ruleForm);
        } else {
          await createTaggingRule(this.ruleForm);
        }
        await this.loadRules();
        this.showRuleForm = false;
        this.resetRuleForm();
      } catch (e) {
        this.ruleError = e.message || 'Failed to save rule';
      } finally {
        this.savingRule = false;
      }
    },
    confirmDeleteRule(rule) {
      this.deleteConfirm = rule;
      this.deleteError = '';
    },
    closeDeleteModal() {
      this.deleteConfirm = null;
      this.deleteError = '';
    },
    async deleteRule() {
      if (!this.deleteConfirm) return;

      this.deleteError = '';
      try {
        await deleteTaggingRule(this.deleteConfirm.id);
        await this.loadRules();
        this.closeDeleteModal();
      } catch (e) {
        console.error('Failed to delete rule:', e);
        this.deleteError = e.message || 'Failed to delete rule. Please try again.';
      }
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
  max-width: 640px;
  background: var(--color-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.card-header h3 {
  margin: 0;
}

.settings-card h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: var(--color-text);
}

.theme-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
}

.theme-option input {
  margin: 0;
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

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-icon {
  background: transparent;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--color-text-secondary);
  border-radius: 4px;
}

.btn-icon:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text);
}

.btn-icon.btn-danger:hover {
  background: #fee2e2;
  color: #dc2626;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
  border-color: #dc2626;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}

.btn-danger:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}

.status {
  margin-top: 12px;
  font-size: 13px;
  color: var(--color-success);
}

.status.error {
  color: var(--color-primary);
}

/* Tagging Rules Styles */
.rule-form {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-secondary);
}

.rule-form h4 {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: var(--color-text);
}

.rule-form input[type="text"],
.rule-form input[type="number"],
.rule-form select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  font-size: 14px;
  background: var(--color-bg);
  margin-bottom: 12px;
}

.rule-form input:focus,
.rule-form select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.conditions-section {
  margin: 16px 0;
}

.condition-row {
  margin-bottom: 8px;
}

.condition-row label {
  display: block;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.action-section,
.priority-section {
  margin: 16px 0 12px 0;
}

.priority-section input {
  width: 100px;
  margin-bottom: 4px;
}

.priority-help {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.enabled-section {
  margin: 16px 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.checkbox-label input {
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.rules-list {
  margin-top: 16px;
}

.loading,
.empty-state {
  padding: 20px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  margin-bottom: 8px;
  background: var(--color-bg);
}

.rule-item.disabled {
  opacity: 0.6;
}

.rule-info {
  flex: 1;
  min-width: 0;
}

.rule-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.disabled-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  color: var(--color-text-secondary);
}

.rule-conditions {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.condition {
  display: inline-block;
  margin-right: 12px;
}

.rule-action {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.rule-action strong {
  color: var(--color-text);
}

.priority-badge {
  margin-left: 8px;
  font-size: 10px;
  padding: 2px 6px;
  background: var(--color-primary);
  color: white;
  border-radius: 4px;
}

.rule-actions {
  display: flex;
  gap: 4px;
  margin-left: 12px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-bg);
  padding: 24px;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
}

.modal p {
  margin: 0 0 20px 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* Notifications Styles */
.notify-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notify-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.notify-label {
  color: var(--color-text-secondary);
  min-width: 80px;
}

.notify-value {
  color: var(--color-text);
  font-family: monospace;
  font-size: 12px;
}

.notify-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.badge-active {
  background: #dcfce7;
  color: #166534;
}

.badge-inactive {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.notify-details {
  margin-top: 4px;
  padding: 8px 12px;
  background: var(--color-bg-secondary);
  border-radius: 6px;
}

.notify-setup-help {
  margin-top: 8px;
}

.notify-provider-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notify-provider-option {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.5;
}

.notify-provider-option a {
  color: var(--color-primary);
  text-decoration: none;
}

.notify-provider-option a:hover {
  text-decoration: underline;
}

.notify-provider-option code {
  display: block;
  margin-top: 4px;
  padding: 6px 10px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
  word-break: break-all;
}

.setup-steps {
  margin: 8px 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.8;
}

.setup-steps li {
  color: var(--color-text);
}

.setup-steps code {
  display: inline;
  margin-top: 0;
  padding: 1px 5px;
  font-size: 12px;
}
</style>
