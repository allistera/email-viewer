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
            <!-- Left category sidebar -->
            <aside class="sm-sidebar" aria-label="Settings categories">
              <h2 id="settings-title" class="sm-title">Settings</h2>
              <nav class="sm-cats" role="tablist">
                <button
                  v-for="cat in categories"
                  :key="cat.id"
                  role="tab"
                  :aria-selected="activeCategory === cat.id"
                  :class="['sm-cat', { active: activeCategory === cat.id }]"
                  @click="activeCategory = cat.id"
                >
                  {{ cat.label }}
                </button>
              </nav>
            </aside>

            <!-- Main panel -->
            <section class="sm-panel" role="tabpanel">
              <header class="sm-panel-header">
                <h3>{{ currentCategoryLabel }}</h3>
                <button class="sm-close" @click="$emit('close')" aria-label="Close settings">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
                  </svg>
                </button>
              </header>

              <div v-if="activeCategory === 'general'" class="sm-content">
                <div class="field-group">
                  <label class="field-label" for="settings-fullname">Full Name</label>
                  <input
                    id="settings-fullname"
                    v-model="fullName"
                    type="text"
                    class="field-input"
                    placeholder="Enter your full name"
                    @input="saveFullName"
                  />
                </div>

                <div class="field-group">
                  <label class="field-label" for="settings-colour-mode">Default Colour Mode</label>
                  <select
                    id="settings-colour-mode"
                    v-model="colourMode"
                    class="field-input"
                    @change="saveColourMode"
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>

              <div v-else-if="activeCategory === 'templates'" class="sm-content">
                <div class="tpl-toolbar">
                  <p class="tpl-hint">Reusable subject and body snippets you can apply when composing.</p>
                  <button type="button" class="tpl-new-btn" @click="startNewTemplate">+ New Template</button>
                </div>

                <ul v-if="templates.length > 0" class="tpl-list">
                  <li
                    v-for="tpl in templates"
                    :key="tpl.id"
                    :class="['tpl-row', { active: editingId === tpl.id }]"
                  >
                    <button type="button" class="tpl-row-main" @click="editTemplate(tpl)">
                      <span class="tpl-row-name">{{ tpl.name }}</span>
                      <span class="tpl-row-subject">{{ tpl.subject || '(no subject)' }}</span>
                    </button>
                    <button
                      type="button"
                      class="tpl-row-delete"
                      :aria-label="`Delete template: ${tpl.name}`"
                      title="Delete template"
                      @click="removeTemplate(tpl.id)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                      </svg>
                    </button>
                  </li>
                </ul>
                <p v-else class="tpl-empty">No templates yet.</p>

                <div v-if="editingId !== null" class="tpl-editor">
                  <div class="field-group">
                    <label class="field-label" for="tpl-name">Name</label>
                    <input
                      id="tpl-name"
                      v-model="editName"
                      type="text"
                      class="field-input"
                      placeholder="e.g. Status update"
                    />
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="tpl-subject">Subject</label>
                    <input
                      id="tpl-subject"
                      v-model="editSubject"
                      type="text"
                      class="field-input"
                      placeholder="Subject line"
                    />
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="tpl-body">Body</label>
                    <textarea
                      id="tpl-body"
                      v-model="editBody"
                      class="field-input tpl-body-input"
                      rows="6"
                      placeholder="Template body…"
                    ></textarea>
                  </div>
                  <div class="tpl-editor-actions">
                    <button type="button" class="tpl-btn-secondary" @click="cancelEdit">Cancel</button>
                    <button
                      type="button"
                      class="tpl-btn-primary"
                      :disabled="!editName.trim()"
                      @click="commitEdit"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { getPreference, setPreference } from '../services/theme.js';
import { listTemplates, saveTemplate, deleteTemplate } from '../services/templates.js';

const FULL_NAME_KEY = 'userFullName';

export default {
  name: 'SettingsModal',
  props: {
    show: { type: Boolean, required: true }
  },
  emits: ['close'],

  data() {
    return {
      activeCategory: 'general',
      categories: [
        { id: 'general', label: 'General' },
        { id: 'templates', label: 'Templates' }
      ],
      fullName: localStorage.getItem(FULL_NAME_KEY) || '',
      colourMode: getPreference(),
      templates: [],
      editingId: null,
      editName: '',
      editSubject: '',
      editBody: ''
    };
  },

  computed: {
    currentCategoryLabel() {
      const cat = this.categories.find(c => c.id === this.activeCategory);
      return cat ? cat.label : '';
    }
  },

  watch: {
    show(val) {
      if (val) {
        this.fullName = localStorage.getItem(FULL_NAME_KEY) || '';
        this.colourMode = getPreference();
        this.refreshTemplates();
        this.cancelEdit();
        this.$nextTick(() => this.$refs.overlay?.focus());
      }
    }
  },

  methods: {
    saveFullName() {
      localStorage.setItem(FULL_NAME_KEY, this.fullName);
    },
    saveColourMode() {
      setPreference(this.colourMode);
    },
    refreshTemplates() {
      this.templates = listTemplates();
    },
    startNewTemplate() {
      this.editingId = '';
      this.editName = '';
      this.editSubject = '';
      this.editBody = '';
    },
    editTemplate(tpl) {
      this.editingId = tpl.id;
      this.editName = tpl.name || '';
      this.editSubject = tpl.subject || '';
      this.editBody = tpl.body || '';
    },
    cancelEdit() {
      this.editingId = null;
      this.editName = '';
      this.editSubject = '';
      this.editBody = '';
    },
    commitEdit() {
      const id = saveTemplate({
        id: this.editingId || null,
        name: this.editName,
        subject: this.editSubject,
        body: this.editBody
      });
      if (!id) return;
      this.refreshTemplates();
      this.cancelEdit();
    },
    removeTemplate(id) {
      deleteTemplate(id);
      if (this.editingId === id) this.cancelEdit();
      this.refreshTemplates();
    }
  }
};
</script>

<style scoped>
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

.settings-modal {
  width: 100%;
  max-width: 720px;
  height: 480px;
  max-height: 86vh;
  background: var(--color-bg);
  border-radius: 14px;
  box-shadow: 0 24px 64px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--color-border);
  display: flex;
  overflow: hidden;
}

.sm-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sm-title {
  margin: 0 0 4px 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.sm-cats {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sm-cat {
  text-align: left;
  padding: 8px 12px;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.sm-cat:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.sm-cat.active {
  background: var(--color-bg-hover);
  color: var(--color-text);
  font-weight: 600;
}

.sm-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sm-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--color-border);
}

.sm-panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--color-text);
}

.sm-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: var(--color-text-secondary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: background 0.12s, color 0.12s;
}

.sm-close:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.sm-content {
  flex: 1;
  overflow-y: auto;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.field-input {
  width: 100%;
  max-width: 360px;
  padding: 9px 11px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  font-size: 13px;
  background: var(--color-bg);
  color: var(--color-text);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.tpl-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tpl-hint {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.tpl-new-btn {
  padding: 7px 12px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}

.tpl-new-btn:hover {
  background: var(--color-bg-hover);
}

.tpl-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.tpl-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
}

.tpl-row:last-child {
  border-bottom: none;
}

.tpl-row.active {
  background: var(--color-bg-hover);
}

.tpl-row-main {
  flex: 1;
  text-align: left;
  background: none;
  border: none;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tpl-row-main:hover {
  background: var(--color-bg-hover);
}

.tpl-row-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tpl-row-subject {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tpl-row-delete {
  background: none;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
}

.tpl-row-delete:hover {
  color: var(--color-primary, #db4c3f);
}

.tpl-empty {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.tpl-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px;
  background: var(--color-bg-secondary);
}

.tpl-body-input {
  max-width: none;
  resize: vertical;
  font-family: inherit;
  line-height: 1.4;
}

.tpl-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.tpl-btn-secondary,
.tpl-btn-primary {
  padding: 7px 14px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, opacity 0.12s;
}

.tpl-btn-secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.tpl-btn-secondary:hover {
  background: var(--color-bg-hover);
}

.tpl-btn-primary {
  background: var(--color-primary, #1a73e8);
  border: none;
  color: #fff;
}

.tpl-btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Transitions */
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

@media (max-width: 600px) {
  .settings-modal {
    height: auto;
    max-height: 92vh;
    flex-direction: column;
  }

  .sm-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    padding: 14px;
  }

  .sm-cats {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
