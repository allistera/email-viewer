<template>
  <div class="top-bar">
    <div class="top-bar-content">
      <!-- Left section -->
      <div class="top-bar-left">
        <button
          v-if="isMobile"
          class="mobile-menu-btn"
          @click="$emit('toggle-sidebar')"
          aria-label="Toggle menu"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div class="top-bar-title">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          <h1 class="title-text">{{ pageTitle }}</h1>
        </div>
      </div>

      <!-- Center section - Search -->
      <div class="top-bar-center">
        <div class="search-container">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            class="search-input"
            placeholder="Search emails..."
            :value="searchQuery"
            @input="$emit('search', $event.target.value)"
          />
          <kbd v-if="!isMobile" class="search-shortcut">⌘K</kbd>
        </div>
      </div>

      <!-- Right section -->
      <div class="top-bar-right">
        <button
          class="action-btn"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <svg v-if="isDark" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
        <div class="user-avatar">
          <img
            src="https://ui-avatars.com/api/?name=User&background=5865f2&color=fff&size=128"
            alt="User avatar"
            class="avatar-img"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getPreference, setPreference } from '../services/theme.js';

export default {
  name: 'TopBar',
  props: {
    pageTitle: {
      type: String,
      default: 'Inbox'
    },
    searchQuery: {
      type: String,
      default: ''
    },
    isMobile: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isDark: document.documentElement.classList.contains('dark-mode')
    };
  },
  mounted() {
    this.themeObserver = new MutationObserver(() => {
      this.isDark = document.documentElement.classList.contains('dark-mode');
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  },
  beforeUnmount() {
    if (this.themeObserver) this.themeObserver.disconnect();
  },
  methods: {
    toggleTheme() {
      const current = getPreference();
      const isCurrentlyDark = current === 'dark'
        || (current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setPreference(isCurrentlyDark ? 'light' : 'dark');
    }
  }
};
</script>

<style scoped>
.top-bar {
  height: 56px;
  background: var(--color-topbar-bg);
  border-bottom: 1px solid var(--color-topbar-border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  flex-shrink: 0;
  box-shadow: 0 1px 0 rgba(4, 4, 5, 0.1);
}

.top-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}

.mobile-menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}

.mobile-menu-btn:hover {
  background: var(--color-bg-hover);
}

@media (max-width: 768px) {
  .mobile-menu-btn {
    display: flex;
  }
}

.top-bar-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  width: 28px;
  height: 28px;
  color: var(--color-primary);
}

.title-text {
  font-size: 16px;
  font-weight: 600;
  font-family: 'Lexend', 'Inter', sans-serif;
  color: var(--color-text);
  margin: 0;
}

.top-bar-center {
  flex: 1;
  max-width: 600px;
  display: flex;
  justify-content: center;
}

.search-container {
  position: relative;
  width: 100%;
  max-width: 480px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--color-text-secondary);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 36px;
  padding: 0 80px 0 40px;
  background: var(--color-bg-secondary);
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--color-text);
  font-size: 14px;
  outline: none;
  transition: all 0.15s;
}

.search-input:focus {
  background: var(--color-bg);
  border-color: var(--color-primary);
}

.search-input::placeholder {
  color: var(--color-text-secondary);
}

.search-shortcut {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  padding: 2px 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
  pointer-events: none;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.action-btn:active {
  transform: scale(0.95);
}

.user-avatar {
  margin-left: 4px;
  cursor: pointer;
}

.avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: border-color 0.15s;
}

.avatar-img:hover {
  border-color: var(--color-primary);
}

@media (max-width: 768px) {
  .top-bar {
    height: 60px;
    padding: env(safe-area-inset-top, 0) 12px 0;
    position: sticky;
    top: 0;
    z-index: 20;
    background: color-mix(in srgb, var(--color-topbar-bg) 92%, transparent);
    backdrop-filter: blur(10px);
  }

  .top-bar-left {
    min-width: auto;
    gap: 8px;
  }

  .title-text {
    font-size: 15px;
  }

  .logo-icon {
    width: 24px;
    height: 24px;
  }

  .mobile-menu-btn {
    width: 38px;
    height: 38px;
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-bg-secondary) 76%, transparent);
  }

  .top-bar-right {
    display: none;
  }

  .top-bar-center {
    display: none;
  }

  .action-btn {
    width: 32px;
    height: 32px;
  }

  .action-btn svg {
    width: 18px;
    height: 18px;
  }
}
</style>
