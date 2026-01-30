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
        <div class="detail-toolbar" aria-label="Message actions">
          <button class="toolbar-btn" type="button" :disabled="true" title="Reply (not implemented)">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="toolbar-icon">
              <path
                d="M10 9V5L3 12l7 7v-4c7 0 10 2 13 6-1-9-6-12-13-12Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linejoin="round"
              />
            </svg>
            <span class="toolbar-label">Reply</span>
          </button>

          <button class="toolbar-btn" type="button" :disabled="true" title="Reply all (not implemented)">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="toolbar-icon">
              <path
                d="M7.5 10V6L1.5 12l6 6v-4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linejoin="round"
              />
              <path
                d="M13 9V5L6 12l7 7v-4c7 0 10 2 13 6-1-9-6-12-13-12Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linejoin="round"
              />
            </svg>
            <span class="toolbar-label">Reply all</span>
          </button>

          <button class="toolbar-btn" type="button" :disabled="true" title="Forward (not implemented)">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="toolbar-icon">
              <path
                d="M14 9V5l7 7-7 7v-4c-7 0-10 2-13 6 1-9 6-12 13-12Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linejoin="round"
              />
            </svg>
            <span class="toolbar-label">Forward</span>
          </button>

          <button
            class="toolbar-btn"
            type="button"
            @click="handleArchive"
            :disabled="archiving"
            :title="archiving ? 'Deleting…' : 'Delete (moves to Archive)'"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" class="toolbar-icon">
              <path
                d="M6 7h12m-11 0 1 14h8l1-14M9 7V5h6v2"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="toolbar-label">{{ archiving ? 'Deleting…' : 'Delete' }}</span>
          </button>

          <button
            class="toolbar-btn"
            type="button"
            @click="toggleImportant"
            :disabled="togglingImportant"
            :class="{ active: isImportant }"
            :title="isImportant ? 'Unmark Important' : 'Mark Important'"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" class="toolbar-icon">
              <path
                d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z"
                :fill="isImportant ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            </svg>
            <span class="toolbar-label">Important</span>
          </button>
        </div>

        <div class="detail-header">
          <div class="sender-row">
            <div class="sender-avatar" aria-hidden="true">{{ avatarText }}</div>

            <div class="sender-main">
              <div class="subject-title">{{ message.subject }}</div>

              <div class="sender-subline">
                <span class="sender-name">
                  {{ senderName }}
                </span>
                <span v-if="senderEmail && senderEmail !== senderName" class="sender-email">
                  {{ senderEmail }}
                </span>
              </div>

              <div v-if="message.cc" class="cc-row">
                <span class="cc-label">Cc:</span>
                <span class="cc-value">{{ message.cc }}</span>
              </div>
            </div>

            <div class="sender-date" :title="formatDate(message.receivedAt)">
              {{ relativeDate }}
            </div>
          </div>

          <div class="tag-display">
            <div class="tag-list">
              <div v-for="tag in currentTags" :key="tag" class="tag-chip">
                <TagBadge :tag="tag" />
                <button class="remove-tag-btn" @click="handleRemoveTag(tag)" title="Remove Tag">&times;</button>
              </div>
            </div>

            <template v-if="isAddingTag">
              <div class="tag-add-container">
                <select v-model="selectedAddTag" @change="confirmAddTag" class="tag-select" ref="addTagSelect">
                  <option value="" disabled>Select Tag...</option>
                  <option v-for="tag in availableTags" :key="tag.id" :value="tag.name" :disabled="currentTags.includes(tag.name)">
                    {{ tag.name }}
                  </option>
                </select>
                <button @click="cancelAddingTag" class="cancel-add-btn" title="Cancel">&times;</button>
              </div>
            </template>
            <button v-else @click="startAddingTag" class="add-tag-btn" title="Add Tag">+</button>
          </div>

          <div
            v-if="(message.tagConfidence !== null && message.tagConfidence !== undefined) || message.tagReason"
            class="header-footnote"
          >
            <span v-if="message.tagConfidence !== null && message.tagConfidence !== undefined" class="footnote-item">
              Confidence: {{ formatConfidence(message.tagConfidence) }}
            </span>
            <span v-if="message.tagReason" class="footnote-item footnote-reason">
              {{ message.tagReason }}
            </span>
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
            sandbox
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
import { getAttachmentUrl, addMessageTag, removeMessageTag, getTags, createTag, archiveMessage } from '../services/api.js';
import { formatRelativeDate } from '../utils/dateFormat.js';

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
      isAddingTag: false,
      availableTags: [],
      selectedAddTag: '',
      archiving: false,
      togglingImportant: false
    };
  },
  emits: ['archived'],
  computed: {
    sanitizedHtml() {
      if (!this.message || !this.message.htmlBody) return '';

      return this.message.htmlBody
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
    },
    currentTags() {
      if (!this.message) return [];
      // Prefer tags array (new per-message list), fallback to tag string wrapped in array
      if (this.message.tags && Array.isArray(this.message.tags)) {
           // Filter out null/duplicates if any
           return [...new Set(this.message.tags.filter(t => t))]; 
      }
      return this.message.tag ? [this.message.tag] : [];
    },
    senderParts() {
      const raw = this.message?.from || '';
      const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
      if (match) {
        const name = (match[1] || '').trim();
        const email = (match[2] || '').trim();
        return { name: name || email, email };
      }
      return { name: raw.trim(), email: '' };
    },
    senderName() {
      return this.senderParts.name || 'Unknown sender';
    },
    senderEmail() {
      return this.senderParts.email || '';
    },
    avatarText() {
      const base = this.senderName || '';
      const first = base.trim().charAt(0).toUpperCase();
      return first || '?';
    },
    relativeDate() {
      const ts = this.message?.receivedAt;
      if (!ts) return '';
      return formatRelativeDate(ts);
    },
    isImportant() {
      return this.currentTags.some(t => String(t).toLowerCase() === 'important');
    }
  },
  watch: {
    message() {
      this.cancelAddingTag();
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
    async startAddingTag() {
      this.selectedAddTag = '';
      this.isAddingTag = true;
      await this.loadTags(); // Ensure fresh
      this.$nextTick(() => {
          if (this.$refs.addTagSelect) this.$refs.addTagSelect.focus();
      });
    },
    cancelAddingTag() {
      this.isAddingTag = false;
      this.selectedAddTag = '';
    },
    async confirmAddTag() {
       if (!this.selectedAddTag) return;
       const tagToAdd = this.selectedAddTag;
       this.cancelAddingTag();
       
       try {
           await addMessageTag(this.message.id, tagToAdd);
           // Optimistic update
           if (!this.message.tags) this.message.tags = [];
           if (this.message.tag && !this.message.tags.includes(this.message.tag)) {
               this.message.tags.push(this.message.tag);
           }
           if (!this.message.tags.includes(tagToAdd)) {
               this.message.tags.push(tagToAdd);
           }
           // Update legacy field just in case
           this.message.tag = this.message.tags[0]; 
       } catch (e) {
           alert("Failed to add tag: " + e.message);
       }
    },
    async handleRemoveTag(tag) {
        if (!confirm(`Remove tag "${tag}"?`)) return;
        try {
            await removeMessageTag(this.message.id, tag);
            // Optimistic update
            if (this.message.tags) {
                this.message.tags = this.message.tags.filter(t => t !== tag);
            }
            if (this.message.tag === tag) {
                this.message.tag = this.message.tags && this.message.tags.length > 0 ? this.message.tags[0] : null;
            }
        } catch (e) {
            alert("Failed to remove tag: " + e.message);
        }
    },
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleString();
    },
    formatBytes(bytes) {
      if (bytes === null || bytes === undefined || isNaN(bytes)) return 'Unknown';
      if (bytes === 0) return '0 B';
      if (bytes < 0) return 'Unknown';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },
    formatConfidence(value) {
      return `${Math.round(value * 100)}%`;
    },
    getAttachmentUrl(attachmentId) {
      return getAttachmentUrl(this.message.id, attachmentId);
    },
    async handleArchive() {
      if (!this.message || this.archiving) return;
      
      if (!confirm('Delete this email from Inbox? (It will be moved to Archive)')) return;
      
      this.archiving = true;
      try {
        await archiveMessage(this.message.id);
        this.$emit('archived', this.message.id);
      } catch (e) {
        alert('Failed to delete: ' + e.message);
      } finally {
        this.archiving = false;
      }
    },
    async toggleImportant() {
      if (!this.message || this.togglingImportant) return;

      const tagName = 'Important';
      this.togglingImportant = true;
      try {
        const hasImportant = this.isImportant;

        if (!hasImportant) {
          // Ensure the tag exists; safe to attempt even if it already exists.
          if (!this.availableTags?.some(t => String(t.name).toLowerCase() === 'important')) {
            try {
              await createTag(tagName);
              await this.loadTags();
            } catch (e) {
              console.warn('Could not create Important tag (continuing):', e);
            }
          }

          await addMessageTag(this.message.id, tagName);
          if (!this.message.tags) this.message.tags = [];
          if (!this.message.tags.includes(tagName)) this.message.tags.push(tagName);
        } else {
          await removeMessageTag(this.message.id, tagName);
          if (this.message.tags) {
            this.message.tags = this.message.tags.filter(t => String(t).toLowerCase() !== 'important');
          }
        }
      } catch (e) {
        alert('Failed to update Important: ' + e.message);
      } finally {
        this.togglingImportant = false;
      }
    }
  }
};
</script>

<style scoped>
.detail-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: #5f6368;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}

.toolbar-btn:hover:not(:disabled) {
  background: #f1f3f4;
  color: #3c4043;
}

.toolbar-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.toolbar-btn.active {
  color: #3c4043;
}

.toolbar-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}

.toolbar-label {
  white-space: nowrap;
}

.tag-display {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.tag-list {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.tag-chip {
    display: flex;
    align-items: center;
    background: #f0f0f0;
    border-radius: 12px;
    padding-right: 6px;
}

/* Override TagBadge margin if any */
.tag-chip :deep(.tag-badge) {
    margin: 0;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
}

.remove-tag-btn {
    border: none;
    background: none;
    color: #666;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
    margin-left: 2px;
    opacity: 0.6;
}

.remove-tag-btn:hover {
    opacity: 1;
    color: #cc0000;
}

.add-tag-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px dashed #ccc;
    background: #fff;
    color: #666;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
}

.add-tag-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.tag-add-container {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tag-select {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  font-size: 13px;
  max-width: 150px;
}

.cancel-add-btn {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: #999;
}

.cancel-add-btn:hover {
    color: #333;
}

/* ... existing styles ... */
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
  padding: 18px 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sender-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sender-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #eef1f4;
  color: #3c4043;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex: 0 0 36px;
}

.sender-main {
  min-width: 0;
  flex: 1;
}

.subject-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f1f1f;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sender-subline {
  margin-top: 4px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.sender-name {
  font-size: 13px;
  font-weight: 600;
  color: #3c4043;
}

.sender-email {
  font-weight: 500;
  color: var(--color-text-secondary);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 55%;
}

.cc-row {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--color-text-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.cc-label {
  color: #9aa0a6;
  flex: 0 0 auto;
}

.cc-value {
  color: #5f6368;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sender-date {
  flex: 0 0 auto;
  font-size: 12px;
  color: #5f6368;
  white-space: nowrap;
  margin-left: 10px;
}

.header-footnote {
  font-size: 12px;
  color: var(--color-text-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.footnote-item {
  opacity: 0.9;
}

.footnote-reason {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
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
