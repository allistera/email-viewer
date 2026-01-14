<template>
  <div class="message-list">
    <div class="list-header">
      <h2>Inbox</h2>
      <div class="filters">
        <select v-model="spamFilter" class="filter-select">
          <option value="all">All Messages</option>
          <option value="ham">Safe Only</option>
          <option value="spam">Spam Only</option>
          <option value="unknown">Unknown</option>
        </select>
        <button @click="$emit('refresh')" class="btn-icon" title="Refresh">
          ↻
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading messages...</div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else-if="messages.length === 0" class="empty">
      No messages found
    </div>

    <div v-else class="messages">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message-item', { active: selectedId === message.id }]"
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
            <SpamBadge :status="message.spamStatus" :confidence="message.spamConfidence" />
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
import SpamBadge from './SpamBadge.vue';

export default {
  name: 'MessageList',
  components: {
    SpamBadge
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
  data() {
    return {
      spamFilter: 'all'
    };
  },
  watch: {
    spamFilter(newValue) {
      this.$emit('filter-change', newValue);
    }
  },
  methods: {
    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
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
}

.list-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--color-text);
}

.filters {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-select {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.btn-icon {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  cursor: pointer;
  font-size: 16px;
}

.btn-icon:hover {
  background: var(--color-bg-secondary);
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

.message-item.active {
  background: #fff5f5;
  border-left: 3px solid var(--color-primary);
  padding-left: 13px;
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
</style>
