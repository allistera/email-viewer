<template>
  <aside class="right-rail" aria-label="Workspace apps">
    <nav class="rail-nav" aria-label="Quick apps">
      <button
        class="rail-app"
        type="button"
        title="Email"
        aria-label="Email"
        :data-active="activeView === 'email'"
        @click="$emit('select', 'email')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7" />
          <path d="M22 6L12 13 2 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        class="rail-app"
        type="button"
        title="Kanban"
        aria-label="Kanban"
        :data-active="activeView === 'kanban'"
        @click="$emit('select', 'kanban')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="6" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.7" />
          <rect x="9" y="3" width="6" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.7" />
          <rect x="15" y="3" width="6" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.7" />
        </svg>
      </button>
      <button
        v-if="hasTodoist"
        class="rail-app"
        type="button"
        title="Todoist"
        aria-label="Todoist projects"
        :data-active="todoistOpen"
        @click="$emit('toggle-todoist')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/>
          <path d="M7 12l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </nav>

    <div class="rail-spacer" aria-hidden="true" />

    <button
      class="rail-app rail-settings"
      type="button"
      title="Settings"
      aria-label="Settings"
      :data-active="settingsOpen"
      @click="$emit('toggle-settings')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </aside>
</template>

<script>
import { hasTodoistToken } from '../services/auth.js';

export default {
  name: 'RightSidebar',
  props: {
    activeView: {
      type: String,
      default: 'email'
    },
    todoistOpen: {
      type: Boolean,
      default: false
    },
    settingsOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['select', 'toggle-todoist', 'toggle-settings'],
  computed: {
    hasTodoist() {
      return hasTodoistToken();
    }
  }
};
</script>

<style scoped>
.right-rail {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 18px 10px 20px;
  background: linear-gradient(180deg, var(--color-rail-bg), var(--color-rail-bg-alt));
  border-left: 1px solid var(--color-rail-border);
}

.rail-spacer {
  flex: 1;
}

.rail-settings {
  margin-top: auto;
}

.rail-nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rail-app {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid transparent;
  background: var(--color-rail-icon-bg);
  color: var(--color-rail-icon);
  display: grid;
  place-items: center;
  box-shadow: 0 10px 18px -14px var(--color-rail-shadow);
  transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.rail-app svg {
  width: 20px;
  height: 20px;
}

.rail-app[data-active='true'] {
  color: var(--color-rail-icon-active);
  border-color: var(--color-rail-icon-active);
  box-shadow: 0 10px 22px -14px var(--color-rail-shadow), 0 0 0 1px var(--color-rail-icon-active);
}

.rail-app:hover {
  transform: translateY(-1px);
  background: var(--color-rail-icon-bg-hover);
}

.rail-app:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

@keyframes gear-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.rail-settings:hover svg {
  animation: gear-spin 0.6s ease;
}
</style>
