<template>
  <Teleport to="body">
    <Transition name="settings-fade">
      <div
        v-if="show"
        class="settings-overlay"
        @click.self="$emit('close')"
        @keydown.esc.prevent="$emit('close')"
        tabindex="-1"
        ref="overlay"
      >
        <Transition name="settings-slide">
          <div v-if="show" class="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">

            <!-- Left navigation -->
            <nav class="settings-nav">
              <div class="nav-brand">Settings</div>

              <button
                class="nav-item"
                :class="{ active: activeSection === 'rules' }"
                @click="activeSection = 'rules'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Rules
              </button>

              <button
                class="nav-item"
                :class="{ active: activeSection === 'api-keys' }"
                @click="activeSection = 'api-keys'"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <path d="M15 7a4 4 0 0 1 0 8m-5.5-4h9M5 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                API Keys
              </button>
            </nav>

            <!-- Main content -->
            <div class="settings-content">
              <!-- Header -->
              <div class="content-header">
                <h2 class="content-title">{{ activeSection === 'rules' ? 'Tagging Rules' : 'API Keys' }}</h2>
                <button class="close-btn" @click="$emit('close')" aria-label="Close settings">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>

              <!-- ── Rules ── -->
              <div v-if="activeSection === 'rules'" class="content-body">
                <p class="section-help">
                  Rules automatically tag incoming emails. They take priority over AI classification.
                </p>

                <!-- Add / Edit form -->
                <div v-if="showRuleForm" class="rule-form">
                  <div class="form-header">
                    <span class="form-title">{{ editingRule ? 'Edit Rule' : 'New Rule' }}</span>
                    <button class="btn-ghost" @click="cancelRuleForm">Cancel</button>
                  </div>

                  <label class="field-label" for="sm-rule-name">Name</label>
                  <input id="sm-rule-name" v-model.trim="ruleForm.name" type="text" class="field-input" placeholder="e.g. Newsletter" />

                  <div class="conditions-grid">
                    <div class="condition-row">
                      <label class="condition-label">From</label>
                      <input v-model.trim="ruleForm.matchFrom" type="text" class="field-input" placeholder="newsletter@example.com" />
                    </div>
                    <div class="condition-row">
                      <label class="condition-label">To</label>
                      <input v-model.trim="ruleForm.matchTo" type="text" class="field-input" placeholder="alias@domain.com" />
                    </div>
                    <div class="condition-row">
                      <label class="condition-label">Subject</label>
                      <input v-model.trim="ruleForm.matchSubject" type="text" class="field-input" placeholder="Weekly Update" />
                    </div>
                    <div class="condition-row">
                      <label class="condition-label">Body</label>
                      <input v-model.trim="ruleForm.matchBody" type="text" class="field-input" placeholder="unsubscribe" />
                    </div>
                  </div>

                  <label class="field-label" for="sm-tag-select">Apply Tag</label>
                  <select id="sm-tag-select" v-model="ruleForm.tagName" class="field-input">
                    <option value="">Select a tag…</option>
                    <option v-for="tag in availableTags" :key="tag.id" :value="tag.name">{{ tag.name }}</option>
                  </select>

                  <p v-if="ruleError" class="field-error">{{ ruleError }}</p>

                  <div class="form-actions">
                    <button class="btn-primary" :disabled="!isRuleFormValid || savingRule" @click="saveRule">
                      {{ savingRule ? 'Saving…' : (editingRule ? 'Update' : 'Create Rule') }}
                    </button>
                  </div>
                </div>

                <!-- Rules list -->
                <div v-else>
                  <div v-if="loadingRules" class="empty-hint">Loading rules…</div>

                  <div v-else-if="rules.length === 0" class="empty-hint">
                    No rules yet.
                  </div>

                  <ul v-else class="rules-list">
                    <li v-for="rule in rules" :key="rule.id" class="rule-item" :class="{ 'rule-disabled': !rule.is_enabled }">
                      <div class="rule-meta">
                        <span class="rule-name">{{ rule.name }}</span>
                        <div class="rule-conditions">
                          <span v-if="rule.match_from" class="chip">From: {{ rule.match_from }}</span>
                          <span v-if="rule.match_to" class="chip">To: {{ rule.match_to }}</span>
                          <span v-if="rule.match_subject" class="chip">Subject: {{ rule.match_subject }}</span>
                          <span v-if="rule.match_body" class="chip">Body: {{ rule.match_body }}</span>
                        </div>
                        <span class="rule-tag">→ <strong>{{ rule.tag_name }}</strong></span>
                      </div>
                      <div class="rule-actions">
                        <button class="btn-icon" @click="editRule(rule)" title="Edit" aria-label="Edit rule">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button class="btn-icon btn-icon-danger" @click="confirmDelete(rule)" title="Delete" aria-label="Delete rule">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </li>
                  </ul>

                  <button class="add-rule-btn" @click="showRuleForm = true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
                    </svg>
                    Add Rule
                  </button>
                </div>
              </div>

              <!-- ── API Keys ── -->
              <div v-if="activeSection === 'api-keys'" class="content-body">
                <p class="section-help">
                  API tokens are stored locally in your browser and never sent to external servers.
                </p>

                <div class="key-card">
                  <div class="key-card-header">
                    <svg class="key-card-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                      <path d="M9 11a4 4 0 1 0 8 0 4 4 0 0 0-8 0zm-6 9l6-6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="key-card-title">Todoist</span>
                    <span class="key-card-badge" :class="hasSavedToken ? 'badge-set' : 'badge-unset'">
                      {{ hasSavedToken ? 'Connected' : 'Not set' }}
                    </span>
                  </div>

                  <div class="key-row">
                    <input
                      v-model.trim="todoistToken"
                      :type="showToken ? 'text' : 'password'"
                      class="field-input key-input"
                      placeholder="Paste your Todoist API token"
                      autocomplete="off"
                    />
                    <button class="btn-ghost-sm" @click="showToken = !showToken">
                      {{ showToken ? 'Hide' : 'Show' }}
                    </button>
                  </div>

                  <p v-if="tokenStatus" class="token-status" :class="{ 'token-error': tokenStatusType === 'error' }">
                    {{ tokenStatus }}
                  </p>

                  <div class="key-actions">
                    <button class="btn-primary" :disabled="savingToken" @click="saveToken">
                      {{ savingToken ? 'Saving…' : 'Save' }}
                    </button>
                    <button class="btn-secondary" :disabled="!hasSavedToken" @click="clearToken">
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Delete confirmation -->
  <Teleport to="body">
    <div v-if="deleteTarget" class="confirm-overlay" @click.self="deleteTarget = null">
      <div class="confirm-dialog">
        <h4>Delete Rule</h4>
        <p>Delete "<strong>{{ deleteTarget.name }}</strong>"?</p>
        <p v-if="deleteError" class="field-error">{{ deleteError }}</p>
        <div class="confirm-actions">
          <button class="btn-danger" @click="deleteRule">Delete</button>
          <button class="btn-secondary" @click="deleteTarget = null">Cancel</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { getTodoistToken, setTodoistToken, clearTodoistToken } from '../services/auth.js';
import { getTaggingRules, createTaggingRule, updateTaggingRule, deleteTaggingRule, getTags } from '../services/api.js';

export default {
  name: 'SettingsModal',
  props: {
    show: { type: Boolean, required: true }
  },
  emits: ['close'],
  data() {
    return {
      activeSection: 'rules',

      // Rules
      rules: [],
      availableTags: [],
      loadingRules: false,
      showRuleForm: false,
      editingRule: null,
      savingRule: false,
      ruleError: '',
      ruleForm: { name: '', matchFrom: '', matchTo: '', matchSubject: '', matchBody: '', tagName: '' },

      // Delete confirm
      deleteTarget: null,
      deleteError: '',

      // Todoist token
      todoistToken: '',
      showToken: false,
      savingToken: false,
      hasSavedToken: false,
      tokenStatus: '',
      tokenStatusType: 'success'
    };
  },
  computed: {
    isRuleFormValid() {
      return (
        this.ruleForm.name.length > 0 &&
        this.ruleForm.tagName.length > 0 &&
        (this.ruleForm.matchFrom || this.ruleForm.matchTo || this.ruleForm.matchSubject || this.ruleForm.matchBody)
      );
    }
  },
  watch: {
    show(val) {
      if (val) {
        this.loadAll();
        this.$nextTick(() => this.$refs.overlay?.focus());
      } else {
        this.resetRuleForm();
      }
    }
  },
  methods: {
    async loadAll() {
      this.loadingRules = true;
      try {
        const [rules, tags] = await Promise.all([getTaggingRules(), getTags()]);
        this.rules = rules;
        this.availableTags = tags;
      } catch (e) {
        console.error('SettingsModal load error', e);
      } finally {
        this.loadingRules = false;
      }
      const saved = getTodoistToken() || '';
      this.todoistToken = saved;
      this.hasSavedToken = Boolean(saved);
    },

    // ── Rule form ──
    resetRuleForm() {
      this.ruleForm = { name: '', matchFrom: '', matchTo: '', matchSubject: '', matchBody: '', tagName: '' };
      this.editingRule = null;
      this.showRuleForm = false;
      this.ruleError = '';
    },
    cancelRuleForm() {
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
        tagName: rule.tag_name
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
          await updateTaggingRule(this.editingRule.id, { ...this.ruleForm, isEnabled: true });
        } else {
          await createTaggingRule({ ...this.ruleForm, isEnabled: true });
        }
        this.rules = await getTaggingRules();
        this.resetRuleForm();
      } catch (e) {
        this.ruleError = e.message || 'Failed to save rule.';
      } finally {
        this.savingRule = false;
      }
    },
    confirmDelete(rule) {
      this.deleteTarget = rule;
      this.deleteError = '';
    },
    async deleteRule() {
      if (!this.deleteTarget) return;
      this.deleteError = '';
      try {
        await deleteTaggingRule(this.deleteTarget.id);
        this.rules = await getTaggingRules();
        this.deleteTarget = null;
      } catch (e) {
        this.deleteError = e.message || 'Failed to delete rule.';
      }
    },

    // ── Token ──
    async saveToken() {
      const t = (this.todoistToken || '').trim();
      if (!t) { this.tokenStatus = 'Token cannot be empty.'; this.tokenStatusType = 'error'; return; }
      this.savingToken = true;
      try {
        setTodoistToken(t);
        this.hasSavedToken = true;
        this.tokenStatus = 'Saved.';
        this.tokenStatusType = 'success';
      } finally {
        this.savingToken = false;
      }
    },
    clearToken() {
      clearTodoistToken();
      this.todoistToken = '';
      this.hasSavedToken = false;
      this.tokenStatus = 'Cleared.';
      this.tokenStatusType = 'success';
    }
  }
};
</script>

<style scoped>
/* ── Overlay ── */
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  padding: 16px;
}

/* ── Modal shell ── */
.settings-modal {
  display: flex;
  width: 100%;
  max-width: 680px;
  max-height: 80vh;
  background: var(--color-bg);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

/* ── Left nav ── */
.settings-nav {
  width: 176px;
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 12px 8px;
  gap: 2px;
}

.nav-brand {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--color-text-secondary);
  padding: 6px 10px 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: none;
  background: none;
  border-radius: 6px;
  font-size: 13.5px;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}

.nav-item:hover {
  background: var(--color-bg-hover);
}

.nav-item.active {
  background: var(--color-bg-hover);
  font-weight: 600;
  color: var(--color-primary);
}

.nav-item.active .nav-icon {
  stroke: var(--color-primary);
}

.nav-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  stroke: var(--color-text-secondary);
}

/* ── Right content ── */
.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.content-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--color-text-secondary);
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.content-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 20px;
}

/* ── Section help text ── */
.section-help {
  margin: 0 0 16px;
  font-size: 12.5px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

/* ── Rules list ── */
.rules-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: var(--color-bg-secondary);
}

.rule-item.rule-disabled {
  opacity: 0.55;
}

.rule-meta {
  flex: 1;
  min-width: 0;
}

.rule-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.rule-conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.chip {
  font-size: 11px;
  padding: 2px 7px;
  background: var(--color-bg-hover);
  border-radius: 20px;
  color: var(--color-text-secondary);
}

.rule-tag {
  font-size: 11.5px;
  color: var(--color-text-secondary);
}

.rule-tag strong {
  color: var(--color-text);
}

.rule-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
}

.btn-icon:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.btn-icon-danger:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* ── Add rule button ── */
.add-rule-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 7px 12px;
  border: 1px dashed var(--color-border);
  border-radius: 7px;
  background: none;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  transition: border-color 0.15s, color 0.15s;
}

.add-rule-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* ── Rule form ── */
.rule-form {
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 14px 16px;
  background: var(--color-bg-secondary);
  margin-bottom: 12px;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.form-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

/* ── Shared field styles ── */
.field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.field-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  font-size: 13px;
  background: var(--color-bg);
  color: var(--color-text);
  box-sizing: border-box;
  margin-bottom: 10px;
  outline: none;
  transition: border-color 0.15s;
}

.field-input:focus {
  border-color: var(--color-primary);
}

.conditions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}

.condition-row {
  display: flex;
  flex-direction: column;
}

.condition-label {
  font-size: 11.5px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.field-error {
  margin: 0 0 10px;
  font-size: 12.5px;
  color: var(--color-primary);
}

/* ── API Keys ── */
.key-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px 16px;
  background: var(--color-bg-secondary);
}

.key-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.key-card-icon {
  color: var(--color-text-secondary);
}

.key-card-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
}

.key-card-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
}

.badge-set {
  background: #dcfce7;
  color: #166534;
}

.badge-unset {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.key-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 2px;
}

.key-input {
  flex: 1;
  margin-bottom: 0;
}

.key-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.token-status {
  font-size: 12.5px;
  color: var(--color-success);
  margin: 6px 0 0;
}

.token-status.token-error {
  color: var(--color-primary);
}

/* ── Buttons ── */
.btn-primary {
  padding: 7px 14px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 7px 14px;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  padding: 7px 14px;
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 13px;
  cursor: pointer;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-ghost {
  background: none;
  border: none;
  font-size: 12.5px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.btn-ghost:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.btn-ghost-sm {
  background: none;
  border: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 5px;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-ghost-sm:hover {
  background: var(--color-bg-hover);
}

/* ── Empty state ── */
.empty-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: 24px 0;
}

/* ── Delete confirm ── */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.confirm-dialog {
  background: var(--color-bg);
  border-radius: 8px;
  padding: 24px;
  max-width: 360px;
  width: 100%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
}

.confirm-dialog h4 {
  margin: 0 0 8px;
  font-size: 15px;
  color: var(--color-text);
}

.confirm-dialog p {
  margin: 0 0 16px;
  font-size: 13.5px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* ── Transitions ── */
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.18s ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

.settings-slide-enter-active,
.settings-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.settings-slide-enter-from,
.settings-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .settings-modal {
    flex-direction: column;
    max-height: 90vh;
  }

  .settings-nav {
    width: 100%;
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    padding: 8px;
    gap: 4px;
    overflow-x: auto;
  }

  .nav-brand {
    display: none;
  }

  .conditions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
