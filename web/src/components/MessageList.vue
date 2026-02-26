<template>
  <div class="message-list">
    <div class="list-header">
      <button class="menu-btn" @click="$emit('open-sidebar')" title="Open menu" aria-label="Open menu">
        <svg viewBox="0 0 24 24" class="menu-icon" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="search-container">
        <input
          v-model="searchInput"
          :placeholder="searchPlaceholder"
          class="search-input"
          @input="handleInput"
        />
      </div>
    </div>

    <div v-if="loading" class="loading">Loading messages...</div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else-if="messages.length === 0" class="empty">
      {{ emptyStateText }}
    </div>

    <div v-else class="messages">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message-item', { active: selectedId === message.id, unread: !message.isRead }]"
        draggable="true"
        role="button"
        tabindex="0"
        @keydown.enter.prevent="$emit('select', message.id)"
        @keydown.space.prevent="$emit('select', message.id)"
        @dragstart="onDragStart($event, message)"
        @click="$emit('select', message.id)"
      >
        <div class="message-header">
          <span class="from">{{ message.from }}</span>
          <span class="time">{{ formatTime(message.receivedAt) }}</span>
        </div>
        <div class="message-subject">
          {{ message.subject }}
        </div>
        <div class="message-footer">
          <span class="snippet">{{ message.snippet }}</span>
          <div class="badges">
            <TagBadge :tag="message.tag" />
            <span v-if="message.hasAttachments" class="attachment-icon" title="Has attachments">
              📎
            </span>
          </div>
        </div>
      </div>

      <div v-if="hasMore" class="load-more">
        <button @click="$emit('load-more')" class="btn-secondary" :disabled="loadingMore">
          {{ loadingMore ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import TagBadge from './TagBadge.vue';
import { formatRelativeDate } from '../utils/dateFormat.js';

export default {
  name: 'MessageList',
  components: {
    TagBadge
  },
  props: {
    messages: {
      type: Array,
      required: true
    },
    selectedId: {
      type: String,
      default: null
    },
    selectedTag: {
      type: String,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    },
    loadingMore: {
      type: Boolean,
      default: false
    },
    hasMore: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: null
    }
  },
  emits: ['select', 'search', 'load-more', 'open-sidebar'],
  data() {
    return {
      searchInput: '',
      searchTimeout: null
    };
  },
  computed: {
    searchPlaceholder() {
      if (this.selectedTag === 'archive') {
        return 'Search in Archive...';
      } else if (this.selectedTag === 'spam') {
        return 'Search in Spam...';
      } else if (this.selectedTag) {
        return `Search in ${this.selectedTag}...`;
      }
      return 'Search all messages...';
    },
    emptyStateText() {
      if (this.searchInput) return `No messages found for "${this.searchInput}"`;
      if (this.selectedTag === 'archive') return 'No archived messages';
      if (this.selectedTag === 'spam') return 'Hooray! No spam here.';
      if (this.selectedTag === 'sent') return 'No sent messages';
      if (this.selectedTag) return `No messages in ${this.selectedTag}`;
      return "You're all caught up! 🎉";
    }
  },
  watch: {
    selectedId(newId) {
      // Scroll selected message into view when it changes
      if (newId) {
        this.$nextTick(() => {
          const selectedEl = this.$el.querySelector('.message-item.active');
          if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        });
      }
    },
    selectedTag() {
      // Clear search when switching tags for a fresh search context
      this.searchInput = '';
    }
  },
  methods: {
    handleInput() {
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.$emit('search', this.searchInput);
      }, 300);
    },
    formatTime(timestamp) {
      return formatRelativeDate(timestamp);
    },

    onDragStart(event, message) {
      event.dataTransfer.effectAllowed = 'copy';
      // Use a custom format or JSON to indicate this is a message, not a tag
      // We'll use 'application/x-message-id' to be safe, or just check format in drop target
      event.dataTransfer.setData('application/x-message-id', message.id);
      event.dataTransfer.setData('text/plain', message.subject); // Fallback
    }
  }
};
</script>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
  border-right: 1px solid var(--color-border);
}

.list-header {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.search-container {
  flex: 1;
  display: flex;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.list-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--color-text);
  display: none; /* Hide title safely if still present in DOM or just remove selector */
}

.loading,
.empty,
.error-message {
  padding: 32px;
  text-align: center;
  color: var(--color-text-secondary);
}

.error-message {
  color: var(--color-primary);
}

.messages {
  flex: 1;
  overflow-y: auto;
}

.message-item {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s;
}

.message-item:hover {
  background: var(--color-bg-secondary);
}

.message-item:focus-visible {
  background: var(--color-bg-secondary);
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  z-index: 1;
}

.message-item.active {
  background: #fff5f5;
  border-left: 3px solid var(--color-primary);
  padding-left: 13px;
}

.message-item.unread .from,
.message-item.unread .message-subject {
  font-weight: 700;
}

.message-item:not(.unread) .from,
.message-item:not(.unread) .message-subject {
  font-weight: 400;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.from {
  font-weight: 600;
  color: var(--color-text);
  font-size: 14px;
}

.time {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.message-subject {
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 4px;
  font-weight: 500;
}

.message-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.snippet {
  font-size: 13px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.badges {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.attachment-icon {
  font-size: 14px;
}

.load-more {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid var(--color-border);
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Hamburger menu button - hidden on desktop */
.menu-btn {
  display: none;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--color-text);
}

.menu-btn:hover {
  background: var(--color-bg-secondary);
}

.menu-icon {
  width: 20px;
  height: 20px;
}

@media (max-width: 768px) {
  .menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .list-header {
    padding: 12px;
    gap: 8px;
  }

  .search-input {
    padding: 10px 12px;
  }

  .message-item {
    padding: 14px;
  }

  .from {
    font-size: 13px;
  }

  .time {
    font-size: 11px;
  }

  .message-subject {
    font-size: 13px;
  }

  .snippet {
    font-size: 12px;
  }
}
</style>
