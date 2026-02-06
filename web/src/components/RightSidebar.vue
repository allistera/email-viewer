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
    </nav>
  </aside>
</template>

<script>
export default {
  name: 'RightSidebar',
  props: {
    activeView: {
      type: String,
      default: 'email'
    }
  },
  emits: ['select']
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

</style>
