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
            </section>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { getPreference, setPreference } from '../services/theme.js';

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
        { id: 'general', label: 'General' }
      ],
      fullName: localStorage.getItem(FULL_NAME_KEY) || '',
      colourMode: getPreference()
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
