<template>
  <Teleport to="body">
    <Transition name="sf">
      <div
        v-if="show"
        class="settings-overlay"
        @click.self="$emit('close')"
        @keydown.esc="$emit('close')"
        tabindex="-1"
        ref="overlay"
      >
        <Transition name="ss">
          <div
            v-if="show"
            class="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <!-- ─── Header ─── -->
            <div class="sm-header">
              <span id="settings-title" class="sm-logo">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Settings
              </span>

              <nav class="sm-tabs" role="tablist" aria-label="Settings sections">
                <button
                  v-for="tab in tabs"
                  :key="tab.id"
                  role="tab"
                  :aria-selected="activeTab === tab.id"
                  :class="['sm-tab', { active: activeTab === tab.id }]"
                  @click="setTab(tab.id)"
                >
                  <span class="sm-tab-icon" aria-hidden="true" v-html="tab.icon"></span>
                  {{ tab.label }}
                </button>
              </nav>

              <button class="sm-close" @click="$emit('close')" aria-label="Close settings">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <!-- ─── Body ─── -->
            <div class="sm-body" role="tabpanel">

              <!-- ══ API Keys ══ -->
              <div v-if="activeTab === 'api-keys'" class="tab-pane">
                <p class="pane-desc">Tokens are stored only in your browser — never sent to third-party servers.</p>

                <!-- Email service token -->
                <div class="key-card">
                  <div class="key-card-top">
                    <span class="key-provider-icon kpi-email" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6L12 13 2 6" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                    <span class="key-provider-name">Inboxer API</span>
                    <span :class="['key-badge', emailToken ? 'badge-ok' : 'badge-na']">
                      {{ emailToken ? 'Connected' : 'Not set' }}
                    </span>
                  </div>
                  <div class="key-row">
                    <input
                      v-model.trim="emailToken"
                      :type="showEmailToken ? 'text' : 'password'"
                      class="fi"
                      placeholder="Paste your API token"
                      autocomplete="off"
                      spellcheck="false"
                    />
                    <button class="btn-ghost-sm" @click="showEmailToken = !showEmailToken">{{ showEmailToken ? 'Hide' : 'Show' }}</button>
                  </div>
                  <p v-if="emailTokenStatus" :class="['key-status', emailTokenStatusType]">{{ emailTokenStatus }}</p>
                  <div class="key-footer">
                    <button class="btn-primary" @click="saveEmailToken">Save</button>
                    <button class="btn-secondary" :disabled="!emailTokenSaved" @click="clearEmailToken">Clear</button>
                  </div>
                </div>

                <!-- Todoist token -->
                <div class="key-card" style="margin-top:12px">
                  <div class="key-card-top">
                    <span class="key-provider-icon kpi-todoist" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75">
                        <circle cx="12" cy="12" r="9"/><path d="M7 12l3 3 7-7" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                    <span class="key-provider-name">Todoist</span>
                    <span :class="['key-badge', todoistToken ? 'badge-ok' : 'badge-na']">
                      {{ todoistToken ? 'Connected' : 'Not set' }}
                    </span>
                  </div>
                  <div class="key-row">
                    <input
                      v-model.trim="todoistToken"
                      :type="showTodoistToken ? 'text' : 'password'"
                      class="fi"
                      placeholder="Paste your Todoist API token"
                      autocomplete="off"
                      spellcheck="false"
                    />
                    <button class="btn-ghost-sm" @click="showTodoistToken = !showTodoistToken">{{ showTodoistToken ? 'Hide' : 'Show' }}</button>
                  </div>
                  <p v-if="todoistTokenStatus" :class="['key-status', todoistTokenStatusType]">{{ todoistTokenStatus }}</p>
                  <div class="key-footer">
                    <button class="btn-primary" @click="saveTodoistToken">Save</button>
                    <button class="btn-secondary" :disabled="!todoistTokenSaved" @click="clearTodoistToken">Clear</button>
                  </div>
                </div>
              </div>

              <!-- ══ Appearance ══ -->
              <div v-if="activeTab === 'appearance'" class="tab-pane">
                <p class="pane-desc">Personalise how Inboxer looks and feels.</p>

                <div class="setting-section">
                  <h3 class="section-title">Theme</h3>
                  <div class="theme-grid">
                    <button
                      v-for="opt in themeOptions"
                      :key="opt.value"
                      :class="['theme-card', { active: themeChoice === opt.value }]"
                      @click="setTheme(opt.value)"
                      :aria-pressed="themeChoice === opt.value"
                    >
                      <div class="theme-preview" :data-theme-preview="opt.value" aria-hidden="true">
                        <div class="tp-sidebar"></div>
                        <div class="tp-main">
                          <div class="tp-list"></div>
                          <div class="tp-bar"></div>
                          <div class="tp-bar short"></div>
                        </div>
                      </div>
                      <span class="theme-label">{{ opt.label }}</span>
                      <span v-if="themeChoice === opt.value" class="theme-check" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3">
                          <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  </div>
                </div>

                <div class="setting-section" style="margin-top:24px">
                  <h3 class="section-title">Message Density</h3>
                  <div class="density-options">
                    <label v-for="d in densityOptions" :key="d.value" :class="['density-opt', { active: densityChoice === d.value }]">
                      <input type="radio" name="density" :value="d.value" v-model="densityChoice" @change="saveDensity" hidden />
                      <span class="density-icon" aria-hidden="true" v-html="d.icon"></span>
                      <span>{{ d.label }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- ══ Tagging ══ -->
              <div v-if="activeTab === 'tagging'" class="tab-pane">
                <p class="pane-desc">Rules automatically apply tags to incoming emails — they take priority over AI classification.</p>

                <!-- Rule form -->
                <div v-if="showRuleForm" class="rule-form">
                  <div class="rule-form-header">
                    <span class="form-title">{{ editingRule ? 'Edit Rule' : 'New Rule' }}</span>
                    <button class="btn-ghost" @click="cancelRuleForm">Cancel</button>
                  </div>

                  <label class="fl" for="sm-rule-name">Name</label>
                  <input id="sm-rule-name" v-model.trim="ruleForm.name" type="text" class="fi" placeholder="e.g. Newsletters" />

                  <div class="conditions-grid">
                    <div class="condition-col">
                      <span class="fl">From</span>
                      <input v-model.trim="ruleForm.matchFrom" type="text" class="fi" placeholder="newsletter@example.com" />
                    </div>
                    <div class="condition-col">
                      <span class="fl">To</span>
                      <input v-model.trim="ruleForm.matchTo" type="text" class="fi" placeholder="alias@domain.com" />
                    </div>
                    <div class="condition-col">
                      <span class="fl">Subject</span>
                      <input v-model.trim="ruleForm.matchSubject" type="text" class="fi" placeholder="Weekly Update" />
                    </div>
                    <div class="condition-col">
                      <span class="fl">Body</span>
                      <input v-model.trim="ruleForm.matchBody" type="text" class="fi" placeholder="unsubscribe" />
                    </div>
                  </div>

                  <label class="fl" for="sm-tag-select">Apply Tag</label>
                  <select id="sm-tag-select" v-model="ruleForm.tagName" class="fi">
                    <option value="">Select a tag…</option>
                    <option v-for="tag in availableTags" :key="tag.id" :value="tag.name">{{ tag.name }}</option>
                  </select>

                  <p v-if="ruleError" class="err-msg">{{ ruleError }}</p>

                  <div class="form-actions">
                    <button class="btn-primary" :disabled="!isRuleFormValid || savingRule" @click="saveRule">
                      {{ savingRule ? 'Saving…' : (editingRule ? 'Update Rule' : 'Create Rule') }}
                    </button>
                  </div>
                </div>

                <!-- Rules list -->
                <template v-else>
                  <div v-if="loadingRules" class="empty-state">Loading rules…</div>

                  <div v-else-if="rules.length === 0" class="empty-state">
                    No rules yet. Add one to automatically tag incoming emails.
                  </div>

                  <ul v-else class="rules-list">
                    <li v-for="rule in rules" :key="rule.id" class="rule-item">
                      <div class="rule-meta">
                        <span class="rule-name">{{ rule.name }}</span>
                        <div class="rule-chips">
                          <span v-if="rule.match_from" class="chip">From: {{ rule.match_from }}</span>
                          <span v-if="rule.match_to" class="chip">To: {{ rule.match_to }}</span>
                          <span v-if="rule.match_subject" class="chip">Subject: {{ rule.match_subject }}</span>
                          <span v-if="rule.match_body" class="chip">Body: {{ rule.match_body }}</span>
                        </div>
                        <span class="rule-dest">→ <strong>{{ rule.tag_name }}</strong></span>
                      </div>
                      <div class="rule-btns">
                        <button class="icon-btn" @click="editRule(rule)" title="Edit rule" aria-label="Edit rule">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button class="icon-btn icon-btn-danger" @click="confirmDelete(rule)" title="Delete rule" aria-label="Delete rule">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </li>
                  </ul>

                  <button class="add-rule-btn" @click="showRuleForm = true">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
                    </svg>
                    Add Rule
                  </button>
                </template>
              </div>

              <!-- ══ Notifications ══ -->
              <div v-if="activeTab === 'notifications'" class="tab-pane">
                <p class="pane-desc">Control when Inboxer alerts you about activity.</p>

                <div class="setting-section">
                  <h3 class="section-title">Desktop Notifications</h3>

                  <div v-if="notifPermission === 'denied'" class="notif-blocked">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    Notifications are blocked. Enable them in your browser's site settings.
                  </div>

                  <template v-else>
                    <div v-if="notifPermission !== 'granted'" class="notif-request">
                      <p>Allow Inboxer to show desktop notifications for new emails.</p>
                      <button class="btn-primary" @click="requestNotifPermission">Enable Notifications</button>
                    </div>

                    <div v-if="notifPermission === 'granted'" class="toggle-rows">
                      <label class="toggle-row">
                        <div class="toggle-info">
                          <span class="toggle-label">New email</span>
                          <span class="toggle-desc">Show a notification when a new email arrives.</span>
                        </div>
                        <button
                          :class="['toggle-btn', { on: notifSettings.newEmail }]"
                          role="switch"
                          :aria-checked="notifSettings.newEmail"
                          @click="notifSettings.newEmail = !notifSettings.newEmail; saveNotifSettings()"
                        >
                          <span class="toggle-thumb"></span>
                        </button>
                      </label>

                      <label class="toggle-row">
                        <div class="toggle-info">
                          <span class="toggle-label">Mentions &amp; replies</span>
                          <span class="toggle-desc">Show a notification when someone replies to you.</span>
                        </div>
                        <button
                          :class="['toggle-btn', { on: notifSettings.mentions }]"
                          role="switch"
                          :aria-checked="notifSettings.mentions"
                          @click="notifSettings.mentions = !notifSettings.mentions; saveNotifSettings()"
                        >
                          <span class="toggle-thumb"></span>
                        </button>
                      </label>
                    </div>
                  </template>
                </div>
              </div>

              <!-- ══ Models ══ -->
              <div v-if="activeTab === 'models'" class="tab-pane">
                <p class="pane-desc">Configure AI providers for composing, summarising, and classifying emails. The active provider is offered when starting a new AI action.</p>

                <div v-for="provider in modelProviders" :key="provider.id" class="provider-card">
                  <div class="provider-top">
                    <span class="provider-icon" :data-pid="provider.id" aria-hidden="true" v-html="provider.logo"></span>
                    <span class="provider-name">{{ provider.name }}</span>
                    <span :class="['key-badge', modelConfig[provider.id].apiKey ? 'badge-ok' : 'badge-na']">
                      {{ modelConfig[provider.id].apiKey ? 'Configured' : 'Not set' }}
                    </span>
                  </div>

                  <div class="provider-fields">
                    <div class="key-row">
                      <input
                        v-model.trim="modelConfig[provider.id].apiKey"
                        :type="showModelKey[provider.id] ? 'text' : 'password'"
                        class="fi"
                        :placeholder="`${provider.name} API key`"
                        autocomplete="off"
                        spellcheck="false"
                      />
                      <button class="btn-ghost-sm" @click="showModelKey[provider.id] = !showModelKey[provider.id]">
                        {{ showModelKey[provider.id] ? 'Hide' : 'Show' }}
                      </button>
                    </div>

                    <div class="model-select-row">
                      <label :for="`model-sel-${provider.id}`" class="fl">Model</label>
                      <select :id="`model-sel-${provider.id}`" v-model="modelConfig[provider.id].selectedModel" class="fi model-select">
                        <option v-for="m in provider.models" :key="m" :value="m">{{ m }}</option>
                      </select>
                    </div>
                  </div>

                  <p v-if="modelSaveStatus[provider.id]" :class="['key-status', modelSaveStatusType[provider.id]]">
                    {{ modelSaveStatus[provider.id] }}
                  </p>

                  <div class="key-footer">
                    <button class="btn-primary" @click="saveModelConfig(provider.id)">Save</button>
                    <button class="btn-secondary" :disabled="!modelConfig[provider.id].apiKey" @click="clearModelConfig(provider.id)">Clear</button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- ─── Delete confirmation ─── -->
  <Teleport to="body">
    <div v-if="deleteTarget" class="confirm-overlay" @click.self="deleteTarget = null">
      <div class="confirm-dialog">
        <h4>Delete Rule</h4>
        <p>Delete "<strong>{{ deleteTarget.name }}</strong>"? This cannot be undone.</p>
        <p v-if="deleteError" class="err-msg">{{ deleteError }}</p>
        <div class="confirm-actions">
          <button class="btn-danger" :disabled="deleting" @click="deleteRule">{{ deleting ? 'Deleting…' : 'Delete' }}</button>
          <button class="btn-secondary" @click="deleteTarget = null">Cancel</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { getToken, setToken, clearToken as clearAuthToken, getTodoistToken, setTodoistToken, clearTodoistToken } from '../services/auth.js';
import { getPreference as getTheme, setPreference as setThemePref } from '../services/theme.js';
import { getTaggingRules, createTaggingRule, updateTaggingRule, deleteTaggingRule, getTags } from '../services/api.js';

const MODEL_STORAGE_KEY = 'ai_model_settings';
const NOTIF_STORAGE_KEY = 'notification_settings';
const DENSITY_STORAGE_KEY = 'message_density';

const DEFAULT_MODEL_CONFIG = {
  gemini:     { apiKey: '', selectedModel: 'gemini-2.0-flash' },
  openrouter: { apiKey: '', selectedModel: 'openai/gpt-4o' },
  claude:     { apiKey: '', selectedModel: 'claude-sonnet-4-6' },
  openai:     { apiKey: '', selectedModel: 'gpt-4o' }
};

function loadModelConfig() {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = {};
      for (const k of Object.keys(DEFAULT_MODEL_CONFIG)) {
        merged[k] = { ...DEFAULT_MODEL_CONFIG[k], ...(parsed[k] || {}) };
      }
      return merged;
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_MODEL_CONFIG));
}

function saveModelConfig(config) {
  localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(config));
}

function loadNotifSettings() {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { newEmail: false, mentions: false };
}

export default {
  name: 'SettingsModal',
  props: {
    show: { type: Boolean, required: true }
  },
  emits: ['close'],

  data() {
    return {
      activeTab: 'api-keys',

      tabs: [
        {
          id: 'api-keys',
          label: 'API Keys',
          icon: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        },
        {
          id: 'appearance',
          label: 'Appearance',
          icon: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round"/></svg>'
        },
        {
          id: 'tagging',
          label: 'Tagging',
          icon: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke-linecap="round" stroke-linejoin="round"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
        },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        },
        {
          id: 'models',
          label: 'Models',
          icon: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 8v8M8 12h8" stroke-linecap="round"/></svg>'
        }
      ],

      // ── API Keys ──
      emailToken: getToken() || '',
      emailTokenSaved: Boolean(getToken()),
      showEmailToken: false,
      emailTokenStatus: '',
      emailTokenStatusType: 'ok',

      todoistToken: getTodoistToken() || '',
      todoistTokenSaved: Boolean(getTodoistToken()),
      showTodoistToken: false,
      todoistTokenStatus: '',
      todoistTokenStatusType: 'ok',

      // ── Appearance ──
      themeChoice: getTheme(),
      themeOptions: [
        { value: 'system', label: 'System' },
        { value: 'light',  label: 'Light' },
        { value: 'dark',   label: 'Dark' }
      ],
      densityChoice: localStorage.getItem(DENSITY_STORAGE_KEY) || 'comfortable',
      densityOptions: [
        {
          value: 'comfortable',
          label: 'Comfortable',
          icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="11" width="18" height="4" rx="1"/><rect x="3" y="18" width="18" height="4" rx="1"/></svg>'
        },
        {
          value: 'compact',
          label: 'Compact',
          icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/><line x1="3" y1="22" x2="21" y2="22"/></svg>'
        }
      ],

      // ── Tagging ──
      rules: [],
      availableTags: [],
      loadingRules: false,
      showRuleForm: false,
      editingRule: null,
      savingRule: false,
      ruleError: '',
      ruleForm: { name: '', matchFrom: '', matchTo: '', matchSubject: '', matchBody: '', tagName: '' },
      deleteTarget: null,
      deleteError: '',
      deleting: false,

      // ── Notifications ──
      notifPermission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
      notifSettings: loadNotifSettings(),

      // ── Models ──
      modelConfig: loadModelConfig(),
      showModelKey: { gemini: false, openrouter: false, claude: false, openai: false },
      modelSaveStatus: { gemini: '', openrouter: '', claude: '', openai: '' },
      modelSaveStatusType: { gemini: 'ok', openrouter: 'ok', claude: 'ok', openai: 'ok' },
      modelProviders: [
        {
          id: 'gemini',
          name: 'Google Gemini',
          logo: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
          models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro']
        },
        {
          id: 'openrouter',
          name: 'OpenRouter',
          logo: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
          models: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3-5-sonnet', 'google/gemini-pro', 'meta-llama/llama-3.1-70b-instruct', 'mistralai/mistral-large']
        },
        {
          id: 'claude',
          name: 'Anthropic Claude',
          logo: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 14l4-8 4 8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 11h5" stroke-linecap="round"/></svg>',
          models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
        },
        {
          id: 'openai',
          name: 'OpenAI',
          logo: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a5 5 0 0 1 4.9 6A5 5 0 1 1 7.1 8 5 5 0 0 1 12 2z"/><path d="M12 22a5 5 0 0 1-4.9-6A5 5 0 1 1 16.9 16 5 5 0 0 1 12 22z"/></svg>',
          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
        }
      ]
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
        this.$nextTick(() => this.$refs.overlay?.focus());
        this.loadTagging();
        this.themeChoice = getTheme();
        this.emailToken = getToken() || '';
        this.emailTokenSaved = Boolean(getToken());
        this.todoistToken = getTodoistToken() || '';
        this.todoistTokenSaved = Boolean(getTodoistToken());
        this.modelConfig = loadModelConfig();
        this.notifPermission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      } else {
        this.cancelRuleForm();
      }
    }
  },

  methods: {
    setTab(id) {
      this.activeTab = id;
    },

    // ── API Keys ──
    saveEmailToken() {
      const t = this.emailToken.trim();
      if (!t) { this.emailTokenStatus = 'Token cannot be empty.'; this.emailTokenStatusType = 'err'; return; }
      setToken(t);
      this.emailTokenSaved = true;
      this.emailTokenStatus = 'Saved.';
      this.emailTokenStatusType = 'ok';
    },
    clearEmailToken() {
      clearAuthToken();
      this.emailToken = '';
      this.emailTokenSaved = false;
      this.emailTokenStatus = 'Cleared.';
      this.emailTokenStatusType = 'ok';
    },
    saveTodoistToken() {
      const t = this.todoistToken.trim();
      if (!t) { this.todoistTokenStatus = 'Token cannot be empty.'; this.todoistTokenStatusType = 'err'; return; }
      setTodoistToken(t);
      this.todoistTokenSaved = true;
      this.todoistTokenStatus = 'Saved.';
      this.todoistTokenStatusType = 'ok';
    },
    clearTodoistToken() {
      clearTodoistToken();
      this.todoistToken = '';
      this.todoistTokenSaved = false;
      this.todoistTokenStatus = 'Cleared.';
      this.todoistTokenStatusType = 'ok';
    },

    // ── Appearance ──
    setTheme(val) {
      this.themeChoice = val;
      setThemePref(val);
    },
    saveDensity() {
      localStorage.setItem(DENSITY_STORAGE_KEY, this.densityChoice);
      document.documentElement.setAttribute('data-density', this.densityChoice);
    },

    // ── Tagging ──
    async loadTagging() {
      this.loadingRules = true;
      try {
        const [rules, tags] = await Promise.all([getTaggingRules(), getTags()]);
        this.rules = rules;
        this.availableTags = tags;
      } catch (e) {
        console.error('loadTagging error', e);
      } finally {
        this.loadingRules = false;
      }
    },
    cancelRuleForm() {
      this.ruleForm = { name: '', matchFrom: '', matchTo: '', matchSubject: '', matchBody: '', tagName: '' };
      this.editingRule = null;
      this.showRuleForm = false;
      this.ruleError = '';
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
        const payload = { ...this.ruleForm, isEnabled: true };
        if (this.editingRule) {
          await updateTaggingRule(this.editingRule.id, payload);
        } else {
          await createTaggingRule(payload);
        }
        this.rules = await getTaggingRules();
        this.cancelRuleForm();
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
      this.deleting = true;
      this.deleteError = '';
      try {
        await deleteTaggingRule(this.deleteTarget.id);
        this.rules = await getTaggingRules();
        this.deleteTarget = null;
      } catch (e) {
        this.deleteError = e.message || 'Failed to delete rule.';
      } finally {
        this.deleting = false;
      }
    },

    // ── Notifications ──
    async requestNotifPermission() {
      if (typeof Notification === 'undefined') return;
      const result = await Notification.requestPermission();
      this.notifPermission = result;
    },
    saveNotifSettings() {
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(this.notifSettings));
    },

    // ── Models ──
    saveModelConfig(providerId) {
      saveModelConfig(this.modelConfig);
      this.modelSaveStatus[providerId] = 'Saved.';
      this.modelSaveStatusType[providerId] = 'ok';
      setTimeout(() => { this.modelSaveStatus[providerId] = ''; }, 2500);
    },
    clearModelConfig(providerId) {
      this.modelConfig[providerId].apiKey = '';
      saveModelConfig(this.modelConfig);
      this.modelSaveStatus[providerId] = 'Cleared.';
      this.modelSaveStatusType[providerId] = 'ok';
      setTimeout(() => { this.modelSaveStatus[providerId] = ''; }, 2500);
    }
  }
};
</script>

<style scoped>
/* ── Overlay ── */
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  padding: 20px;
}

/* ── Modal shell ── */
.settings-modal {
  width: 100%;
  max-width: 780px;
  max-height: 86vh;
  background: var(--color-bg);
  border-radius: 14px;
  box-shadow: 0 24px 64px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ── */
.sm-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px 0;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.sm-logo {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
  white-space: nowrap;
  padding-bottom: 14px;
}

.sm-logo svg {
  color: var(--color-text-secondary);
}

.sm-tabs {
  display: flex;
  gap: 2px;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}

.sm-tabs::-webkit-scrollbar { display: none; }

.sm-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 13px;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
  border-radius: 6px 6px 0 0;
}

.sm-tab:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.sm-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.sm-tab-icon {
  display: flex;
  align-items: center;
  opacity: 0.7;
}

.sm-tab.active .sm-tab-icon { opacity: 1; }

.sm-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: var(--color-text-secondary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  flex-shrink: 0;
  transition: background 0.12s, color 0.12s;
}

.sm-close:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

/* ── Body ── */
.sm-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.tab-pane {
  padding: 22px 24px 28px;
  max-width: 640px;
}

.pane-desc {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.55;
}

/* ── API Keys ── */
.key-card {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
  background: var(--color-bg-secondary);
}

.key-card-top {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 12px;
}

.key-provider-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.kpi-email { background: #eff6ff; color: #2563eb; }
.kpi-todoist { background: #fef2f2; color: #dc2626; }

.key-provider-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
}

.key-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
}

.badge-ok  { background: #dcfce7; color: #166534; }
.badge-na  { background: var(--color-bg-hover); color: var(--color-text-secondary); }

.key-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.key-row .fi { flex: 1; margin-bottom: 0; }

.key-status {
  font-size: 12px;
  margin: 5px 0 0;
}

.key-status.ok  { color: #16a34a; }
.key-status.err { color: #dc2626; }

.key-footer {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* ── Appearance ── */
.setting-section {}
.section-title {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.theme-card {
  position: relative;
  border: 2px solid var(--color-border);
  border-radius: 10px;
  padding: 10px;
  background: var(--color-bg-secondary);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: border-color 0.15s;
}

.theme-card:hover { border-color: var(--color-primary); }
.theme-card.active { border-color: var(--color-primary); }

.theme-preview {
  width: 100%;
  height: 54px;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  border: 1px solid rgba(0,0,0,0.08);
}

/* System preview follows actual theme */
.theme-preview[data-theme-preview="system"] .tp-sidebar { background: var(--color-bg-secondary); width: 28%; border-right: 1px solid var(--color-border); }
.theme-preview[data-theme-preview="system"] .tp-main { background: var(--color-bg); flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
.theme-preview[data-theme-preview="system"] .tp-list { background: var(--color-bg-hover); height: 8px; border-radius: 3px; }
.theme-preview[data-theme-preview="system"] .tp-bar  { background: var(--color-border); height: 5px; border-radius: 3px; }

/* Light preview always light */
.theme-preview[data-theme-preview="light"] .tp-sidebar { background: #f0f0f0; width: 28%; border-right: 1px solid #e5e5e5; }
.theme-preview[data-theme-preview="light"] .tp-main { background: #fff; flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
.theme-preview[data-theme-preview="light"] .tp-list { background: #e8e8e8; height: 8px; border-radius: 3px; }
.theme-preview[data-theme-preview="light"] .tp-bar  { background: #d0d0d0; height: 5px; border-radius: 3px; }
.theme-preview[data-theme-preview="light"] .tp-bar.short { width: 60%; }

/* Dark preview always dark */
.theme-preview[data-theme-preview="dark"] .tp-sidebar { background: #1e1e1e; width: 28%; border-right: 1px solid #333; }
.theme-preview[data-theme-preview="dark"] .tp-main { background: #141414; flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
.theme-preview[data-theme-preview="dark"] .tp-list { background: #2a2a2a; height: 8px; border-radius: 3px; }
.theme-preview[data-theme-preview="dark"] .tp-bar  { background: #333; height: 5px; border-radius: 3px; }
.theme-preview[data-theme-preview="dark"] .tp-bar.short { width: 60%; }

.theme-label { font-size: 12px; font-weight: 500; color: var(--color-text); }

.theme-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  background: var(--color-primary);
  color: #fff;
  border-radius: 50%;
  display: grid;
  place-items: center;
}

/* Density */
.density-options {
  display: flex;
  gap: 10px;
}

.density-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
  transition: border-color 0.15s, color 0.15s;
}

.density-opt:hover { border-color: var(--color-primary); color: var(--color-text); }
.density-opt.active { border-color: var(--color-primary); color: var(--color-primary); font-weight: 600; }
.density-icon { display: flex; align-items: center; }

/* ── Tagging ── */
.rules-list {
  list-style: none;
  margin: 0 0 10px;
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
  border-radius: 8px;
  background: var(--color-bg-secondary);
}

.rule-meta { flex: 1; min-width: 0; }

.rule-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.rule-chips {
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

.rule-dest {
  font-size: 11.5px;
  color: var(--color-text-secondary);
}

.rule-dest strong { color: var(--color-text); }

.rule-btns {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 5px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  transition: background 0.12s, color 0.12s;
}

.icon-btn:hover { background: var(--color-bg-hover); color: var(--color-text); }
.icon-btn-danger:hover { background: #fee2e2; color: #dc2626; }

.add-rule-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border: 1.5px dashed var(--color-border);
  border-radius: 8px;
  background: none;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  transition: border-color 0.15s, color 0.15s;
}

.add-rule-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

/* Rule form */
.rule-form {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
  background: var(--color-bg-secondary);
  margin-bottom: 12px;
}

.rule-form-header {
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

.conditions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
}

.condition-col { display: flex; flex-direction: column; }

.form-actions { margin-top: 14px; }

/* ── Notifications ── */
.notif-blocked {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  padding: 10px 14px;
  border-radius: 8px;
}

.notif-request {
  display: flex;
  align-items: center;
  gap: 14px;
}

.notif-request p {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  flex: 1;
}

.toggle-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 8px;
  cursor: default;
  transition: background 0.12s;
}

.toggle-row:hover { background: var(--color-bg-hover); }

.toggle-info { flex: 1; }
.toggle-label { display: block; font-size: 13.5px; font-weight: 500; color: var(--color-text); }
.toggle-desc  { display: block; font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }

.toggle-btn {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: var(--color-border);
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle-btn.on { background: var(--color-primary); }

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-btn.on .toggle-thumb { left: 21px; }

/* ── Models ── */
.provider-card {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
  background: var(--color-bg-secondary);
  margin-bottom: 12px;
}

.provider-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.provider-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.provider-icon[data-pid="gemini"]     { background: #f0fdf4; color: #16a34a; }
.provider-icon[data-pid="openrouter"] { background: #fef3c7; color: #d97706; }
.provider-icon[data-pid="claude"]     { background: #fdf4ff; color: #a855f7; }
.provider-icon[data-pid="openai"]     { background: #f0f9ff; color: #0284c7; }

.provider-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
}

.provider-fields { display: flex; flex-direction: column; gap: 10px; }

.model-select-row {
  display: flex;
  flex-direction: column;
}

.model-select { width: 100%; }

/* ── Shared field helpers ── */
.fi {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  font-size: 13px;
  background: var(--color-bg);
  color: var(--color-text);
  box-sizing: border-box;
  margin-bottom: 10px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.fi:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb, 99, 102, 241), 0.12);
}

.fl {
  display: block;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 5px;
}

.err-msg {
  font-size: 12.5px;
  color: #dc2626;
  margin: 4px 0 8px;
}

.empty-state {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: 28px 0;
}

/* ── Buttons ── */
.btn-primary {
  padding: 7px 16px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 7px 16px;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 7px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover:not(:disabled) { background: var(--color-bg-secondary); }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-danger {
  padding: 7px 16px;
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-danger:hover:not(:disabled) { background: #b91c1c; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-ghost {
  background: none;
  border: none;
  font-size: 12.5px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 5px;
}

.btn-ghost:hover { color: var(--color-text); background: var(--color-bg-hover); }

.btn-ghost-sm {
  background: none;
  border: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.12s;
}

.btn-ghost-sm:hover { background: var(--color-bg-hover); }

/* ── Delete confirm ── */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 20px;
}

.confirm-dialog {
  background: var(--color-bg);
  border-radius: 12px;
  padding: 24px;
  max-width: 380px;
  width: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--color-border);
}

.confirm-dialog h4 { margin: 0 0 8px; font-size: 15px; color: var(--color-text); }
.confirm-dialog p  { margin: 0 0 16px; font-size: 13.5px; color: var(--color-text-secondary); line-height: 1.5; }

.confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* ── Transitions ── */
.sf-enter-active,
.sf-leave-active {
  transition: opacity 0.2s ease;
}

.sf-enter-from,
.sf-leave-to {
  opacity: 0;
}

.ss-enter-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34, 1.36, 0.64, 1);
}

.ss-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.ss-enter-from,
.ss-leave-to {
  opacity: 0;
  transform: scale(0.94) translateY(-10px);
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .settings-modal {
    max-height: 92vh;
    border-radius: 12px 12px 0 0;
  }

  .sm-tabs {
    gap: 0;
  }

  .sm-tab {
    padding: 6px 9px 12px;
    font-size: 12px;
  }

  .tab-pane {
    padding: 16px 16px 20px;
  }

  .theme-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .conditions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
