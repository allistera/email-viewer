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

    <div class="rail-divider" aria-hidden="true"></div>

    <div class="rail-controls">
      <button
        class="theme-toggle"
        type="button"
        :class="{ 'is-dark': isDark }"
        :aria-pressed="isDark"
        :title="toggleTitle"
        aria-label="Toggle dark mode"
        @click="toggleTheme"
      >
        <span class="toggle-icon sun" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6" />
          </svg>
        </span>
        <span class="toggle-icon moon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M20 15.3A8 8 0 0 1 8.7 4a6.5 6.5 0 1 0 11.3 11.3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span class="toggle-knob"></span>
      </button>
      <span class="theme-caption">{{ themeCaption }}</span>
    </div>
  </aside>
</template>

<script>
export default {
  name: 'RightSidebar',
  data() {
    return {
      themePreference: 'system',
      systemDark: false,
      mediaQuery: null
    };
  },
  computed: {
    isDark() {
      if (this.themePreference === 'system') {
        return this.systemDark;
      }
      return this.themePreference === 'dark';
    },
    themeCaption() {
      if (this.themePreference === 'system') {
        return 'System';
      }
      return this.isDark ? 'Dark' : 'Light';
    },
    toggleTitle() {
      return this.isDark ? 'Switch to light mode' : 'Switch to dark mode';
    }
  },
  mounted() {
    const stored = localStorage.getItem('theme-preference');
    if (stored === 'light' || stored === 'dark') {
      this.themePreference = stored;
    }

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemDark = this.mediaQuery.matches;
    this.applyTheme();

    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', this.handleSystemChange);
    } else if (this.mediaQuery.addListener) {
      this.mediaQuery.addListener(this.handleSystemChange);
    }
  },
  beforeUnmount() {
    if (!this.mediaQuery) return;
    if (this.mediaQuery.removeEventListener) {
      this.mediaQuery.removeEventListener('change', this.handleSystemChange);
    } else if (this.mediaQuery.removeListener) {
      this.mediaQuery.removeListener(this.handleSystemChange);
    }
  },
  methods: {
    handleSystemChange(event) {
      this.systemDark = event.matches;
      if (this.themePreference === 'system') {
        this.applyTheme();
      }
    },
    toggleTheme() {
      const nextTheme = this.isDark ? 'light' : 'dark';
      this.themePreference = nextTheme;
      localStorage.setItem('theme-preference', nextTheme);
      this.applyTheme();
    },
    applyTheme() {
      const root = document.documentElement;
      if (this.themePreference === 'system') {
        root.removeAttribute('data-theme');
        return;
      }
      root.setAttribute('data-theme', this.themePreference);
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

.rail-divider {
  width: 28px;
  height: 1px;
  background: var(--color-rail-border);
}

.rail-controls {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.theme-toggle {
  position: relative;
  width: 48px;
  height: 26px;
  padding: 4px 5px;
  border-radius: 999px;
  border: 1px solid var(--color-rail-border);
  background: var(--color-rail-toggle-bg);
  color: var(--color-rail-icon);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.theme-toggle .toggle-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  opacity: 0.65;
  transition: opacity 0.2s ease;
}

.theme-toggle .toggle-icon svg {
  width: 14px;
  height: 14px;
}

.theme-toggle .toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-rail-toggle-knob);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

.theme-toggle.is-dark .toggle-knob {
  transform: translateX(20px);
}

.theme-toggle.is-dark .toggle-icon.sun {
  opacity: 0.35;
}

.theme-toggle:not(.is-dark) .toggle-icon.moon {
  opacity: 0.35;
}

.theme-toggle:hover {
  border-color: var(--color-primary);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.theme-caption {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}
</style>
