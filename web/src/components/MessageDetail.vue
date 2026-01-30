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
          <div class="header-top">
            <h2>{{ message.subject }}</h2>
            <button 
              class="archive-btn" 
              @click="handleArchive" 
              :disabled="archiving"
              title="Archive this email"
            >
              <span v-if="archiving">Archiving...</span>
              <span v-else>📦 Archive</span>
            </button>
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
        <!-- Hide legacy single tag row if we show them in header -->
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
import { getAttachmentUrl, addMessageTag, removeMessageTag, getTags, archiveMessage } from '../services/api.js';

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
      archiving: false
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
      
      if (!confirm('Archive this email?')) return;
      
      this.archiving = true;
      try {
        await archiveMessage(this.message.id);
        this.$emit('archived', this.message.id);
      } catch (e) {
        alert('Failed to archive: ' + e.message);
      } finally {
        this.archiving = false;
      }
    }
  }
};
</script>

<style scoped>
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
  padding: 24px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header-top {
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

.archive-btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.archive-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
}

.archive-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
