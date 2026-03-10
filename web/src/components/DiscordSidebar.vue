<template>
  <aside class="discord-sidebar">
    <!-- Compose Button -->
    <button class="compose-btn-main" @click="$emit('compose')">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      <span>Compose</span>
    </button>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <!-- Main folders -->
      <div class="nav-section">
        <h3 class="section-title">Mailboxes</h3>
        <ul class="nav-list">
          <li>
            <button
              class="nav-item"
              :class="{ active: selectedTag === null && !settingsActive }"
              @click="$emit('select', null)"
              @dragover.prevent
              @drop="handleDropInbox"
            >
              <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <span class="nav-label">Inbox</span>
              <span v-if="inboxCount" class="nav-badge">{{ inboxCount }}</span>
            </button>
          </li>

          <li>
            <button
              class="nav-item"
              :class="{ active: selectedTag === 'sent' }"
              @click="$emit('select', 'sent')"
            >
              <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span class="nav-label">Sent</span>
              <span v-if="sentCount" class="nav-badge">{{ sentCount }}</span>
            </button>
          </li>

          <li>
            <button
              class="nav-item"
              :class="{ active: selectedTag === 'archive' }"
              @click="$emit('select', 'archive')"
            >
              <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span class="nav-label">Archive</span>
              <span v-if="archiveCount" class="nav-badge">{{ archiveCount }}</span>
            </button>
          </li>

          <li>
            <button
              class="nav-item"
              :class="{ active: selectedTag === 'spam' }"
              @click="$emit('select', 'spam')"
            >
              <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span class="nav-label">Spam</span>
              <span v-if="spamCount" class="nav-badge danger">{{ spamCount }}</span>
            </button>
          </li>
        </ul>
      </div>

      <!-- Tags section -->
      <div class="nav-section">
        <div class="section-header">
          <h3 class="section-title">Tags</h3>
          <button class="add-tag-btn" @click="showAddTag = !showAddTag" title="Add tag">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div v-if="showAddTag" class="add-tag-form">
          <input
            ref="tagInput"
            v-model="newTagName"
            type="text"
            class="tag-input"
            placeholder="New tag name..."
            @keyup.enter="addTag"
            @keyup.esc="cancelAddTag"
          />
        </div>

        <ul class="nav-list tags-list">
          <li v-for="tag in tags" :key="tag.name">
            <button
              class="nav-item tag-item"
              :class="{ active: selectedTag === tag.name }"
              @click="$emit('select', tag.name)"
              @dragover.prevent
              @drop="handleDropTag($event, tag.name)"
            >
              <span class="tag-color" :style="{ background: tag.color || '#6366f1' }"></span>
              <span class="nav-label">{{ tag.name }}</span>
              <span v-if="tag.count" class="nav-badge">{{ tag.count }}</span>
            </button>
          </li>

          <li v-if="tags.length === 0 && !showAddTag" class="empty-state">
            <span class="empty-text">No tags yet</span>
          </li>
        </ul>
      </div>
    </nav>


  </aside>
</template>

<script>
export default {
  name: 'DiscordSidebar',
  props: {
    selectedTag: {
      type: String,
      default: null
    },
    messageCounts: {
      type: Object,
      default: () => ({})
    },
    settingsActive: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      showAddTag: false,
      newTagName: '',
      tags: [
        { name: 'Work', color: '#5865f2', count: 0 },
        { name: 'Personal', color: '#23a559', count: 0 },
        { name: 'Todo', color: '#f0b232', count: 0 },
      ]
    };
  },
  computed: {
    inboxCount() {
      return this.messageCounts?.inbox || 0;
    },
    sentCount() {
      return this.messageCounts?.sent || 0;
    },
    archiveCount() {
      return this.messageCounts?.archive || 0;
    },
    spamCount() {
      return this.messageCounts?.spam || 0;
    }
  },
  watch: {
    showAddTag(val) {
      if (val) {
        this.$nextTick(() => {
          this.$refs.tagInput?.focus();
        });
      }
    }
  },
  methods: {
    addTag() {
      if (!this.newTagName.trim()) return;

      this.tags.push({
        name: this.newTagName.trim(),
        color: this.getRandomColor(),
        count: 0
      });

      this.newTagName = '';
      this.showAddTag = false;
    },
    cancelAddTag() {
      this.newTagName = '';
      this.showAddTag = false;
    },
    getRandomColor() {
      const colors = ['#5865f2', '#23a559', '#f0b232', '#f23f43', '#6d28d9', '#db4c3f'];
      return colors[Math.floor(Math.random() * colors.length)];
    },
    handleDropInbox(event) {
      const messageId = event.dataTransfer.getData('text/plain');
      if (messageId) {
        this.$emit('message-dropped', { messageId, newTag: null });
      }
    },
    handleDropTag(event, tagName) {
      const messageId = event.dataTransfer.getData('text/plain');
      if (messageId) {
        this.$emit('message-dropped', { messageId, newTag: tagName });
      }
    }
  }
};
</script>

<style scoped>
.discord-sidebar {
  width: 240px;
  background: var(--color-sidebar-bg);
  display: flex;
  flex-direction: column;
  height: 100vh;
  border-right: 1px solid var(--color-border);
  overflow: hidden;
}

.compose-btn-main {
  margin: 16px;
  height: 40px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.compose-btn-main:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.compose-btn-main:active {
  transform: translateY(0);
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}

.nav-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  margin-bottom: 4px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  letter-spacing: 0.5px;
  padding: 0 8px;
  margin-bottom: 4px;
}

.add-tag-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.add-tag-btn:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-text);
}

.add-tag-form {
  padding: 4px 8px;
  margin-bottom: 8px;
}

.tag-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.tag-input:focus {
  border-color: var(--color-primary);
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 2px;
}

.nav-item:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-text);
}

.nav-item.active {
  background: var(--color-sidebar-hover);
  color: var(--color-text);
  font-weight: 600;
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-badge {
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.nav-item.active .nav-badge {
  background: rgba(255, 255, 255, 0.2);
}

.nav-badge.danger {
  background: var(--color-danger);
  color: white;
}

.tag-item {
  position: relative;
}

.tag-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.empty-state {
  padding: 12px;
  text-align: center;
}

.empty-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.footer-btn {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.footer-btn:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-text);
}

.footer-btn.active {
  background: var(--color-sidebar-active);
  color: white;
}

@media (max-width: 768px) {
  .discord-sidebar {
    width: 100%;
  }
}
</style>
