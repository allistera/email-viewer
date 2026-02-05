<template>
  <aside class="right-rail" aria-label="Workspace apps">
    <nav class="rail-nav" aria-label="Quick apps">
      <button
        class="rail-app"
        type="button"
        title="Calendar"
        aria-label="Calendar"
        data-active="true"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7" />
          <path d="M7 3v3.5M17 3v3.5M3 9h18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
        </svg>
      </button>
      <button class="rail-app" type="button" title="Keep" aria-label="Keep notes">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0-3.2 11.1V18a1 1 0 0 0 1 1h4.4a1 1 0 0 0 1-1v-3.9A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.7" />
          <path d="M9.3 21h5.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
        </svg>
      </button>
      <button class="rail-app" type="button" title="Tasks" aria-label="Tasks">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7h11M7 12h11M7 17h11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          <path d="M4 7l1.2 1.2L7 6.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 12l1.2 1.2L7 11.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button class="rail-app" type="button" title="Contacts" aria-label="Contacts">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12.5a3.5 3.5 0 1 0-3.5-3.5 3.5 3.5 0 0 0 3.5 3.5z" fill="none" stroke="currentColor" stroke-width="1.7" />
          <path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
        </svg>
      </button>
    </nav>

  </aside>
</template>

<script>
export default {
  name: 'RightSidebar'
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
