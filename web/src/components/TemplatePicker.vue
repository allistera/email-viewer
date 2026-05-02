<template>
  <div class="template-picker">
    <button
      type="button"
      class="icon-btn"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="menu"
      title="Insert template"
      aria-label="Insert template"
      @click="toggle"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="13" y2="17"/>
      </svg>
    </button>
    <div v-if="open" class="template-menu" role="menu">
      <p v-if="templates.length === 0" class="template-empty">
        No templates yet. Add some in Settings → Templates.
      </p>
      <button
        v-for="tpl in templates"
        :key="tpl.id"
        type="button"
        role="menuitem"
        class="template-menu-item"
        @click="select(tpl)"
      >
        <span class="template-menu-name">{{ tpl.name }}</span>
        <span v-if="tpl.subject" class="template-menu-subject">{{ tpl.subject }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { listTemplates } from '../services/templates.js';

export default {
  name: 'TemplatePicker',
  props: {
    disabled: { type: Boolean, default: false }
  },
  emits: ['select'],
  data() {
    return {
      open: false,
      templates: []
    };
  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.handleDocumentClick);
  },
  methods: {
    toggle() {
      if (this.open) {
        this.close();
        return;
      }
      this.templates = listTemplates();
      this.open = true;
      document.addEventListener('mousedown', this.handleDocumentClick);
    },
    close() {
      this.open = false;
      document.removeEventListener('mousedown', this.handleDocumentClick);
    },
    select(tpl) {
      this.$emit('select', tpl);
      this.close();
    },
    handleDocumentClick(event) {
      if (!this.$el?.contains?.(event.target)) {
        this.close();
      }
    }
  }
};
</script>

<style scoped>
.template-picker {
  position: relative;
  display: inline-flex;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--color-text-secondary, #5f6368);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.icon-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary, #f1f3f4);
  color: var(--color-text, #202020);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.template-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  max-width: 320px;
  max-height: 280px;
  overflow-y: auto;
  background: var(--color-bg, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 4px;
  z-index: 10;
}

.template-empty {
  margin: 0;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--color-text-secondary, #5f6368);
}

.template-menu-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  background: transparent;
  border: none;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}

.template-menu-item:hover,
.template-menu-item:focus-visible {
  background: var(--color-bg-secondary, #f1f3f4);
  outline: none;
}

.template-menu-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text, #202020);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.template-menu-subject {
  font-size: 12px;
  color: var(--color-text-secondary, #5f6368);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
</style>
