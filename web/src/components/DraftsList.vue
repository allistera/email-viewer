<template>
  <div class="message-list">
    <div class="list-header">
      <button class="menu-btn" @click="$emit('open-sidebar')" title="Open menu" aria-label="Open menu">
        <svg viewBox="0 0 24 24" class="menu-icon" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <h2 class="list-title">Drafts</h2>
    </div>

    <div v-if="drafts.length === 0" class="empty">
      No drafts
    </div>

    <div v-else class="messages">
      <div
        v-for="draft in drafts"
        :key="draft.id"
        class="message-item draft-item"
        @click="$emit('open', draft)"
        role="button"
        tabindex="0"
        @keydown.enter.prevent="$emit('open', draft)"
        @keydown.space.prevent="$emit('open', draft)"
      >
        <div class="message-body">
          <div class="message-header">
            <span class="from">{{ recipientSummary(draft) }}</span>
            <span class="time">{{ formatTime(draft.updatedAt) }}</span>
          </div>
          <div class="message-subject" :title="draft.subject">
            {{ draft.subject || '(No subject)' }}
          </div>
          <div class="message-footer">
            <span class="snippet" :title="draft.body">{{ snippet(draft.body) }}</span>
            <button
              type="button"
              class="delete-btn"
              :aria-label="`Delete draft: ${draft.subject || 'No subject'}`"
              title="Delete draft"
              @click.stop="$emit('delete', draft.id)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DraftsList',
  props: {
    drafts: {
      type: Array,
      default: () => []
    }
  },
  emits: ['open', 'delete', 'open-sidebar'],
  methods: {
    recipientSummary(draft) {
      const recipients = Array.isArray(draft.recipients) ? draft.recipients : [];
      if (recipients.length === 0) return '(No recipients)';
      if (recipients.length === 1) return `To: ${recipients[0]}`;
      return `To: ${recipients[0]} +${recipients.length - 1}`;
    },
    snippet(body) {
      if (!body) return '';
      const cleaned = String(body).replace(/\s+/g, ' ').trim();
      return cleaned.length > 140 ? `${cleaned.slice(0, 140)}…` : cleaned;
    },
    formatTime(timestamp) {
      if (!timestamp) return '';
      const d = new Date(timestamp);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      if (sameDay) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const sameYear = d.getFullYear() === now.getFullYear();
      return d.toLocaleDateString([], sameYear
        ? { month: 'short', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' });
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
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.menu-btn {
  display: none;
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.menu-icon {
  width: 22px;
  height: 22px;
}

.list-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.messages {
  flex: 1;
  overflow-y: auto;
}

.message-item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.1s;
}

.message-item:hover {
  background: var(--color-bg-secondary);
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.from {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.message-subject {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin: 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.snippet {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-btn {
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: var(--color-bg-tertiary, #ececec);
  color: var(--color-primary, #db4c3f);
}

@media (max-width: 768px) {
  .menu-btn {
    display: inline-flex;
  }
}
</style>
