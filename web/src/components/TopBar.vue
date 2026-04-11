<template>
  <div class="top-bar">
    <div class="top-bar-content">
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

      <div class="top-bar-right">
        <button class="action-btn" aria-label="Refresh" title="Refresh" @click="$emit('refresh')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M20 11a8 8 0 10.7 3.3M20 4v7h-7"/>
          </svg>
        </button>
        <button class="action-btn action-btn-primary" aria-label="Compose" title="Compose" @click="$emit('compose')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12h14"/>
          </svg>
        </button>
        <button class="action-btn" aria-label="Settings" title="Settings" @click="$emit('settings')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.3 3.8a1 1 0 011.4 0l.8.8a1 1 0 001 .24l1.1-.3a1 1 0 011.2.7l.3 1.1a1 1 0 00.7.7l1.1.3a1 1 0 01.7 1.2l-.3 1.1a1 1 0 00.24 1l.8.8a1 1 0 010 1.4l-.8.8a1 1 0 00-.24 1l.3 1.1a1 1 0 01-.7 1.2l-1.1.3a1 1 0 00-.7.7l-.3 1.1a1 1 0 01-1.2.7l-1.1-.3a1 1 0 00-1 .24l-.8.8a1 1 0 01-1.4 0l-.8-.8a1 1 0 00-1-.24l-1.1.3a1 1 0 01-1.2-.7l-.3-1.1a1 1 0 00-.7-.7l-1.1-.3a1 1 0 01-.7-1.2l.3-1.1a1 1 0 00-.24-1l-.8-.8a1 1 0 010-1.4l.8-.8a1 1 0 00.24-1l-.3-1.1a1 1 0 01.7-1.2l1.1-.3a1 1 0 00.7-.7l.3-1.1a1 1 0 011.2-.7l1.1.3a1 1 0 001-.24l.8-.8z"/>
            <circle cx="12" cy="12" r="3.2" stroke-width="1.8"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
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
  }
};
</script>

<style scoped>
.top-bar {
  height: 56px;
  background: color-mix(in srgb, var(--color-topbar-bg) 96%, transparent);
  border-bottom: 1px solid var(--color-topbar-border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  flex-shrink: 0;
  box-shadow: 0 1px 0 rgba(4, 4, 5, 0.08);
  backdrop-filter: blur(10px);
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
  border-radius: 10px;
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
  width: 26px;
  height: 26px;
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
  max-width: 520px;
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
  height: 38px;
  padding: 0 80px 0 40px;
  background: color-mix(in srgb, var(--color-bg-secondary) 92%, var(--color-bg));
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
  border-radius: 10px;
  color: var(--color-text);
  font-size: 14px;
  outline: none;
  transition: all 0.15s;
}

.search-input:focus {
  background: var(--color-bg);
  border-color: color-mix(in srgb, var(--color-primary) 70%, var(--color-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.15s;
}

.action-btn svg {
  width: 18px;
  height: 18px;
}

.action-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border);
  color: var(--color-text);
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn-primary {
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
}

.action-btn-primary:hover {
  background: color-mix(in srgb, var(--color-primary) 22%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 36%, transparent);
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .top-bar {
    height: 60px;
    padding: env(safe-area-inset-top, 0) 12px 0;
    position: sticky;
    top: 0;
    z-index: 20;
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
  }

  .top-bar-center {
    max-width: none;
  }

  .search-container {
    max-width: none;
  }

  .search-input {
    height: 36px;
    font-size: 13px;
    padding-right: 40px;
  }

  .search-shortcut {
    display: none;
  }

  .top-bar-right {
    gap: 6px;
  }

  .action-btn {
    width: 34px;
    height: 34px;
  }

  .action-btn svg {
    width: 17px;
    height: 17px;
  }
}
</style>
