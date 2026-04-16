<template>
  <div class="message-list">
    <div class="list-header">
      <button class="menu-btn" @click="$emit('open-sidebar')" title="Open menu" aria-label="Open menu">
        <svg viewBox="0 0 24 24" class="menu-icon" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div v-if="selectedIds.length > 0" class="bulk-action-bar">
      <span class="bulk-count">{{ selectedIds.length }} selected</span>
      <button class="bulk-done-btn" @click="$emit('bulk-archive', selectedIds)" title="Mark selected as done">
        Mark as Done
      </button>
    </div>

    <div v-if="loading" class="loading">Loading messages...</div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else-if="messages.length === 0" class="empty">
      No messages found
    </div>

    <VirtualList
      v-else
      :class="['messages', { 'bulk-active': selectedIds.length > 0 }]"
      :items="messages"
      :item-height="itemHeight"
      ref="virtualList"
      @near-bottom="onNearBottom"
    >
      <template #default="{ item: message }">
        <div
          :class="['message-item', { active: selectedId === message.id, unread: !message.isRead, 'bulk-selected': selectedIds.includes(message.id) }]"
          draggable="true"
          @dragstart="onDragStart($event, message)"
          @click="$emit('select', message.id)"
          role="button"
          tabindex="0"
          @keydown.enter.prevent="$emit('select', message.id)"
          @keydown.space.prevent="$emit('select', message.id)"
        >
          <button
            type="button"
            class="message-checkbox"
            :class="{ checked: selectedIds.includes(message.id) }"
            :aria-label="selectedIds.includes(message.id) ? 'Deselect message' : 'Select message'"
            :aria-pressed="selectedIds.includes(message.id)"
            @click.stop="$emit('toggle-select', message.id, $event)"
          >
            <svg v-if="selectedIds.includes(message.id)" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M3 8l3.5 3.5L13 4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="message-body">
            <div class="message-header">
              <span class="from">{{ message.from }}</span>
              <span class="time">{{ formatTime(message.receivedAt) }}</span>
            </div>
            <div class="message-subject" :title="message.subject">
              {{ message.subject }}
            </div>
            <div class="message-footer">
              <span class="snippet" :title="message.snippet">{{ message.snippet }}</span>
              <div class="badges">
                <TagBadge :tag="message.tag" />
                <span v-if="message.threadReplyCount > 0" class="thread-count" :title="`${message.threadReplyCount} more in thread`">
                  {{ message.threadReplyCount + 1 }}
                </span>
                <span v-if="message.hasAttachments" class="attachment-icon" title="Has attachments">
                  📎
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="hasMore || loadingMore" class="load-more-indicator">
          <span v-if="loadingMore" class="loading-spinner"></span>
        </div>
      </template>
    </VirtualList>
  </div>
</template>

<script>
import TagBadge from './TagBadge.vue';
import VirtualList from './VirtualList.vue';
import { formatRelativeDate } from '../utils/dateFormat.js';

export default {
  name: 'MessageList',
  components: {
    TagBadge,
    VirtualList
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
    selectedIds: {
      type: Array,
      default: () => []
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
  emits: ['select', 'search', 'load-more', 'open-sidebar', 'bulk-archive', 'toggle-select'],
  data() {
    return {
      itemHeight: 100 // Default fixed height
    };
  },
  watch: {
    selectedId(newId) {
      if (newId) {
        this.scrollToSelected();
      }
    },
    loading(isLoading) {
      if (!isLoading && this.selectedId) {
        this.scrollToSelected();
      }
    }
  },
  methods: {
    formatTime(timestamp) {
      return formatRelativeDate(timestamp);
    },

    onDragStart(event, message) {
      event.dataTransfer.effectAllowed = 'copy';
      // Use custom MIME and text/plain fallback for broader browser compatibility.
      event.dataTransfer.setData('application/x-message-id', message.id);
      event.dataTransfer.setData('text/plain', message.id);
    },

    scrollToSelected() {
      this.$nextTick(() => {
        const index = this.messages.findIndex(m => m.id === this.selectedId);
        if (index !== -1 && this.$refs.virtualList) {
          this.$refs.virtualList.scrollToIndex(index);
        }
      });
    },

    onNearBottom() {
      if (this.hasMore && !this.loadingMore) {
        this.$emit('load-more');
      }
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

/* Shown only on mobile for the menu button; hidden on desktop (global search used) */
.list-header {
  display: none;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  align-items: center;
  gap: 12px;
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
  /* Overflow handled by VirtualList */
}

.message-item {
  padding: 16px 16px 16px 10px;
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  transition: background 0.15s;
  height: 100px;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.message-checkbox {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s, opacity 0.15s;
  opacity: 0;
  padding: 0;
}

.message-item:hover .message-checkbox,
.message-item.bulk-selected .message-checkbox,
.bulk-active .message-checkbox {
  opacity: 1;
}

.message-checkbox.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
  opacity: 1;
}

.message-checkbox:hover:not(.checked) {
  border-color: var(--color-primary);
}

.message-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.message-item:active {
  cursor: grabbing;
}

.message-item:hover {
  background: var(--color-bg-secondary);
}

.message-item:focus-visible {
  background: var(--color-bg-secondary);
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.message-item.active {
  background: #fff5f5;
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
  white-space: nowrap; /* Force single line */
  overflow: hidden;
  text-overflow: ellipsis;
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

.thread-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 9px;
  font-size: 11px;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.attachment-icon {
  font-size: 14px;
}

.bulk-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  flex-shrink: 0;
}

.bulk-count {
  font-weight: 600;
}

.bulk-done-btn {
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s;
}

.bulk-done-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}

.message-item.bulk-selected {
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg));
  border-left: 3px solid var(--color-primary);
  padding-left: 13px;
}

.load-more-indicator {
  padding: 12px;
  text-align: center;
  min-height: 40px;
}

.loading-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
  .message-list {
    border-right: none;
    background: transparent;
  }

  .list-header {
    display: flex;
    padding: 10px 12px 8px;
    gap: 8px;
    border-bottom: none;
  }

  .menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    min-width: 44px;
    min-height: 44px;
  }

  .message-item {
    margin: 0 10px 8px;
    padding: 12px 14px;
    height: 96px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg);
    -webkit-tap-highlight-color: transparent;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .message-item.active {
    border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 35%, transparent);
  }

  .messages {
    padding-bottom: 12px;
  }

  .from {
    font-size: 14px;
  }

  .time {
    font-size: 12px;
  }

  .message-subject {
    font-size: 13px;
  }

  .snippet {
    font-size: 12px;
  }


}
</style>
