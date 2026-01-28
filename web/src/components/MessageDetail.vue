<template>
  <div class="message-detail">
    <div v-if="loading" class="loading">Loading message...</div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else-if="!message" class="empty">
      Select a message to view details
    </div>

      <div v-else class="detail-content">
        <div class="detail-header">
          <h2>{{ message.subject }}</h2>
          <div class="tag-display">
            <template v-if="isEditingTag">
              <div class="tag-edit-container">
                <select v-model="selectedNewTag" class="tag-select">
                  <option value="">No Tag</option>
                  <option v-for="tag in availableTags" :key="tag.id" :value="tag.name">
                    {{ tag.name }}
                  </option>
                </select>
                <button @click="saveTag" class="save-tag-btn">Save</button>
                <button @click="cancelEditingTag" class="cancel-tag-btn">Cancel</button>
              </div>
            </template>
            <template v-else>
              <TagBadge :tag="message.tag" />
              <button @click="startEditingTag" class="edit-tag-btn" title="Edit Tag">
                ✎
              </button>
            </template>
          </div>
        </div>

        <div class="meta">
        <div class="meta-row">
          <span class="label">From:</span>
          <span class="value">{{ message.from }}</span>
        </div>
        <div class="meta-row">
          <span class="label">To:</span>
          <span class="value">{{ message.to }}</span>
        </div>
        <div class="meta-row">
          <span class="label">Date:</span>
          <span class="value">{{ formatDate(message.receivedAt) }}</span>
        </div>
        <div v-if="message.tag" class="meta-row">
          <span class="label">Tag:</span>
          <span class="value">{{ message.tag }}</span>
        </div>
        <div v-if="message.tagConfidence !== null && message.tagConfidence !== undefined" class="meta-row">
          <span class="label">Tag Confidence:</span>
          <span class="value">{{ formatConfidence(message.tagConfidence) }}</span>
        </div>
        <div v-if="message.tagReason" class="meta-row">
          <span class="label">Tag Reason:</span>
          <span class="value">{{ message.tagReason }}</span>
        </div>
      </div>

      <div v-if="message.attachments && message.attachments.length > 0" class="attachments">
        <h3>Attachments</h3>
        <div class="attachment-list">
          <a
            v-for="att in message.attachments"
            :key="att.id"
            :href="getAttachmentUrl(att.id)"
            class="attachment-item"
            :download="att.filename"
          >
            <span class="attachment-icon">📎</span>
            <span class="attachment-name">{{ att.filename }}</span>
            <span class="attachment-size">{{ formatBytes(att.sizeBytes) }}</span>
          </a>
        </div>
      </div>

      <div class="body-content">
        <div v-if="message.htmlBody" class="html-body">
          <iframe
            :srcdoc="sanitizedHtml"
            sandbox="allow-same-origin"
            class="html-iframe"
          ></iframe>
        </div>
        <div v-else class="text-body">
          <pre>{{ message.textBody || 'No content' }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import TagBadge from './TagBadge.vue';
import { getAttachmentUrl, updateMessageTag, getTags } from '../services/api.js';

export default {
  name: 'MessageDetail',
  components: {
    TagBadge
  },
  props: {
    message: {
      type: Object,
      default: null
    },
    loading: {
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
      isEditingTag: false,
      availableTags: [],
      selectedNewTag: ''
    };
  },
  computed: {
    sanitizedHtml() {
      if (!this.message || !this.message.htmlBody) return '';

      return this.message.htmlBody
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
    }
  },
  watch: {
    message() {
      this.cancelEditingTag();
    }
  },
  async mounted() {
    await this.loadTags();
  },
  methods: {
    async loadTags() {
      try {
        const tags = await getTags();
        this.availableTags = tags || [];
      } catch (e) {
        console.error('Failed to load tags in detail view', e);
      }
    },
    startEditingTag() {
      this.selectedNewTag = this.message.tag || '';
      this.isEditingTag = true;
      // Refresh tags to be sure
      this.loadTags();
    },
    cancelEditingTag() {
      this.isEditingTag = false;
      this.selectedNewTag = '';
    },
    async saveTag() {
      if (!this.message) return;
      try {
        await updateMessageTag(this.message.id, this.selectedNewTag);
        // Optimistically update
        this.message.tag = this.selectedNewTag;
        this.isEditingTag = false;
      } catch (e) {
        alert('Failed to update tag: ' + e.message);
      }
    },
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleString();
    },
    formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },
    formatConfidence(value) {
      return `${Math.round(value * 100)}%`;
    },
    getAttachmentUrl(attachmentId) {
      return getAttachmentUrl(this.message.id, attachmentId);
    }
  }
};
</script>

<style scoped>
.tag-edit-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-select {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  font-size: 13px;
}

.edit-tag-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 2px 6px;
  margin-left: 8px;
  border-radius: 4px;
}

.edit-tag-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-primary);
}

.save-tag-btn, .cancel-tag-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: white;
}

.save-tag-btn {
  background: var(--color-primary);
}

.cancel-tag-btn {
  background: #999;
}
.message-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
  overflow: hidden;
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

.detail-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.detail-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--color-text);
  flex: 1;
}

.meta {
  padding: 16px 24px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.meta-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 14px;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.label {
  font-weight: 600;
  color: var(--color-text-secondary);
  min-width: 120px;
}

.value {
  color: var(--color-text);
}

.attachments {
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
}

.attachments h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--color-text);
  font-weight: 600;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  text-decoration: none;
  color: var(--color-text);
  font-size: 14px;
  transition: background 0.15s;
}

.attachment-item:hover {
  background: var(--color-bg-secondary);
}

.attachment-icon {
  font-size: 16px;
}

.attachment-name {
  flex: 1;
}

.attachment-size {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.body-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  padding: 0 24px;
}

.tab {
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.tab:hover:not(:disabled) {
  color: var(--color-text);
}

.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.body-content {
  flex: 1;
  overflow: auto;
}

.text-body {
  padding: 24px;
}

.text-body pre {
  margin: 0;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.html-body {
  height: 100%;
  padding: 0;
}

.html-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.no-content {
  padding: 24px;
  text-align: center;
  color: var(--color-text-secondary);
}
</style>
