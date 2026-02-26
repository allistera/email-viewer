<template>
  <div id="app">
    <AuthModal
      :show="showAuthModal"
      :error-message="authError"
      @submit="handleAuthSubmit"
    />

    <ComposeModal
      :show="showComposeModal"
      :reply-to="replyToMessage"
      :forward-from="forwardMessage"
      @close="handleComposeClose"
      @sent="handleEmailSent"
    />

    <ToastNotification ref="toast" />

    <TodoistSlideout
      :show="showTodoistSlideout"
      @close="showTodoistSlideout = false"
      @todoist-added="handleTodoistAdded"
    />

    <SettingsModal
      :show="showSettingsModal"
      @close="showSettingsModal = false"
    />

    <div v-if="!showAuthModal" class="app-layout">
      <div
        class="app-container"
        :class="mobileViewClass"
        :style="gridStyle"
      >
        <TagSidebar
          ref="sidebar"
          :selected-tag="selectedTag"
          :message-counts="messageCounts"
          :settings-active="showSettingsModal"
          class="sidebar-panel"
          @select="handleTagSelect"
          @settings="openSettings"
          @close="closeMobileSidebar"
          @compose="openCompose"
        />

        <div
          v-if="!isMobile && currentView !== 'settings'"
          class="resize-handle resize-handle-sidebar"
          aria-label="Resize sidebar"
          @mousedown.prevent="startResize('sidebar', $event)"
        />

        <template v-if="currentView === 'settings'">
          <SettingsView class="settings-panel" @close="closeSettings" />
        </template>
        <template v-else>
          <MessageList
            v-show="rightRailView !== 'calendar' || isMobile"
            :messages="messages"
            :selected-id="selectedMessageId"
            :selected-tag="selectedTag"
            :loading="loadingMessages"
            :loading-more="loadingMore"
            :has-more="hasMore"
            :error="listError"
            class="list-panel"
            @select="handleSelectMessage"
            @search="handleSearch"
            @load-more="handleLoadMore"
            @open-sidebar="openMobileSidebar"
          />

          <div
            v-if="!isMobile && rightRailView !== 'calendar'"
            class="resize-handle resize-handle-list"
            aria-label="Resize message list"
            @mousedown.prevent="startResize('list', $event)"
          />

          <KanbanView
            v-if="rightRailView === 'kanban' && !isMobile"
            :messages="messages"
            class="kanban-panel"
            @message-dropped="handleMessageDropped"
            @select-message="handleSelectMessage"
            @drop-error="handleDropError"
          />
          <MessageDetail
            v-else
            :message="currentMessage"
            :loading="loadingDetail"
            :error="detailError"
            class="detail-panel"
            @archived="handleMessageArchived"
            @snoozed="handleMessageSnoozed"
            @back="handleMobileBack"
            @reply="handleReply"
            @forward="handleForward"
          />
        </template>

        <RightSidebar
          class="right-sidebar-panel"
          :active-view="rightRailView"
          :todoist-open="showTodoistSlideout"
          :settings-open="showSettingsModal"
          @select="rightRailView = $event"
          @toggle-todoist="showTodoistSlideout = !showTodoistSlideout"
          @toggle-settings="showSettingsModal = !showSettingsModal"
        />
      </div>
    </div>
  </div>
</template>

<script>
import AuthModal from './components/AuthModal.vue';
import TagSidebar from './components/TagSidebar.vue';
import MessageList from './components/MessageList.vue';
import MessageDetail from './components/MessageDetail.vue';
import SettingsView from './components/SettingsView.vue';
import SettingsModal from './components/SettingsModal.vue';
import ComposeModal from './components/ComposeModal.vue';
import ToastNotification from './components/ToastNotification.vue';
import RightSidebar from './components/RightSidebar.vue';
import KanbanView from './components/KanbanView.vue';
import TodoistSlideout from './components/TodoistSlideout.vue';
import { hasToken, setToken, clearToken } from './services/auth.js';
import { getMessages, getMessage, getMessageCounts } from './services/api.js';
import { init as initTheme } from './services/theme.js';
import { realtimeClient } from './services/realtime.js';
import { debounce } from './utils/debounce.js';

export default {
  name: 'App',
  components: {
    AuthModal,
    TagSidebar,
    MessageList,
    MessageDetail,
    SettingsView,
    SettingsModal,
    ComposeModal,
    ToastNotification,
    RightSidebar,
    KanbanView,
    TodoistSlideout
  },
  data() {
    return {
      showAuthModal: !hasToken(),
      messages: [],
      currentMessage: null,
      selectedMessageId: null,
      loadingMessages: false,
      loadingDetail: false,
      loadingMore: false,
      listError: null,
      detailError: null,
      nextBefore: null,
      hasMore: false,
      selectedTag: null,
      searchQuery: '',
      authError: '',
      currentView: 'inbox',
      pendingDeepLinkId: null,
      mobileView: 'list', // 'sidebar', 'list', or 'detail'
      isMobile: false,
      resizeTimeout: null,
      showComposeModal: false,
      replyToMessage: null,
      forwardMessage: null,
      messageCounts: null,
      rightRailView: 'email',
      showTodoistSlideout: false,
      showSettingsModal: false,
      sidebarWidth: 220,
      listWidth: 360,
      rightSidebarWidth: 72,
      resizing: null,
      resizeStartX: 0,
      resizeStartSidebar: 0,
      resizeStartList: 0
    };
  },
  computed: {
    gridStyle() {
      if (this.currentView === 'settings') {
        return {
          gridTemplateColumns: `${this.sidebarWidth}px 1fr 4px ${this.rightSidebarWidth}px`
        };
      }
      if (this.rightRailView === 'calendar') {
        return {
          gridTemplateColumns: `${this.sidebarWidth}px 4px 1fr ${this.rightSidebarWidth}px`
        };
      }
      return {
        gridTemplateColumns: `${this.sidebarWidth}px 4px ${this.listWidth}px 4px 1fr ${this.rightSidebarWidth}px`
      };
    },
    mobileViewClass() {
      if (!this.isMobile) return '';
      return `mobile-view-${this.mobileView}`;
    },
    pageTitle() {
      const base = 'Inboxer';
      if (this.showAuthModal) return base;
      if (this.currentView === 'settings') return `${base} - Settings`;
      const counts = this.messageCounts;
      let label;
      let count;
      if (this.selectedTag === null) {
        label = 'Inbox';
        count = counts?.inbox ?? null;
      } else if (this.selectedTag === 'archive') {
        label = 'Archive';
        count = counts?.archive ?? null;
      } else if (this.selectedTag === 'spam') {
        label = 'Spam';
        count = counts?.spam ?? null;
      } else if (this.selectedTag === 'sent') {
        label = 'Sent';
        count = counts?.sent ?? null;
      } else {
        label = this.selectedTag;
        count = counts?.tags?.[this.selectedTag] ?? null;
      }
      return (count != null && count !== 0) ? `${label} (${count})` : label;
    }
  },
  watch: {
    pageTitle: {
      handler(title) {
        document.title = title;
      },
      immediate: true
    }
  },
  created() {
    this.debouncedRefresh = debounce(() => {
      this.handleRefresh();
      this.loadCounts();
    }, 300);
  },
  mounted() {
    initTheme();
    if (!this.showAuthModal) {
      this.pendingDeepLinkId = this.getDeepLinkMessageId();
      this.init();
    }
    // Initial check without debounce
    this.isMobile = window.innerWidth <= 768;
    window.addEventListener('resize', this.checkMobile);
    window.addEventListener('keydown', this.handleKeydown);

    const sw = localStorage.getItem('sidebar-width');
    const lw = localStorage.getItem('list-width');
    const rw = localStorage.getItem('right-sidebar-width');
    if (sw) this.sidebarWidth = Math.max(160, Math.min(400, parseInt(sw, 10) || 220));
    if (lw) this.listWidth = Math.max(280, Math.min(600, parseInt(lw, 10) || 360));
    if (rw) this.rightSidebarWidth = Math.max(48, Math.min(200, parseInt(rw, 10) || 72));
  },
  beforeUnmount() {
    this.stopResize();
    realtimeClient.disconnect();
    window.removeEventListener('resize', this.checkMobile);
    window.removeEventListener('keydown', this.handleKeydown);
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
  },
  methods: {
    async init() {
      await Promise.all([this.loadMessages(), this.loadCounts()]);
      this.connectRealtime();
    },
    async loadCounts() {
      try {
        this.messageCounts = await getMessageCounts();
      } catch (e) {
        console.error('Failed to load message counts:', e);
      }
    },

    async handleAuthSubmit(token) {
      this.authError = '';
      setToken(token);

      try {
        this.pendingDeepLinkId = this.getDeepLinkMessageId();
        await this.loadMessages();
        
        // If loadMessages failed with 401, it clears the token.
        // We must check if authentication succeeded.
        if (!hasToken()) {
          this.authError = 'Wrong API Key. Please try again.';
          return;
        }

        this.showAuthModal = false;
        this.connectRealtime();
      } catch (error) {
        clearToken();
        this.authError = 'Invalid token. Please try again.';
      }
    },

    async loadMessages(reset = true) {
      if (reset) {
        this.loadingMessages = true;
        this.listError = null;
        this.messages = [];
        this.nextBefore = null;
      } else {
        this.loadingMore = true;
      }

      try {
        const params = {
          limit: 50
        };

        if (this.selectedTag === 'archive') {
           params.archived = true;
        } else if (this.selectedTag === 'spam') {
           params.tag = 'Spam';
        } else if (this.selectedTag === 'sent') {
           params.tag = 'Sent';
        } else if (this.selectedTag) {
          params.tag = this.selectedTag;
          // Exclude archived by default unless viewing archive
          params.archived = false;
        } else {
          // Inbox view (no specific tag selected)
          // Exclude archived, spam, and sent emails
          params.archived = false;
          params.excludeTag = 'Spam';
          params.hideSnoozed = true;
        }
        
        if (this.searchQuery) {
            params.search = this.searchQuery;
        }

        if (!reset && this.nextBefore) {
          params.before = this.nextBefore;
        }

        const response = await getMessages(params);

        const items = response.items || [];

        if (reset) {
          this.messages = items;
        } else {
          this.messages = [...this.messages, ...items];
        }

        this.nextBefore = response.nextBefore;
        this.hasMore = (response.items || []).length === params.limit && response.nextBefore !== null;

        if (reset && this.pendingDeepLinkId) {
          const deepLinkId = this.pendingDeepLinkId;
          this.pendingDeepLinkId = null;
          await this.handleSelectMessage(deepLinkId);
        } else if (reset && this.messages.length > 0 && !this.selectedMessageId) {
          this.handleSelectMessage(this.messages[0].id);
        }
      } catch (error) {
        if (error.status === 401) {
          clearToken();
          this.showAuthModal = true;
        } else {
          this.listError = error.message;
        }
      } finally {
        this.loadingMessages = false;
        this.loadingMore = false;
      }
      this.loadCounts();
    },
    getDeepLinkMessageId() {
      try {
        const url = new URL(window.location.href);
        const searchMessageId = url.searchParams.get('message');
        if (searchMessageId) return searchMessageId;

        const hash = url.hash ? url.hash.replace(/^#/, '') : '';
        if (!hash) return null;

        const hashParams = new URLSearchParams(hash);
        return hashParams.get('message');
      } catch (e) {
        return null;
      }
    },

    async handleSelectMessage(messageId) {
      this.selectedMessageId = messageId;
      this.loadingDetail = true;
      this.detailError = null;
      this.currentMessage = null;

      // Switch to detail view on mobile
      if (this.isMobile) {
        this.mobileView = 'detail';
      }

      try {
        this.currentMessage = await getMessage(messageId);
        // Mark message as read in the list
        const idx = this.messages.findIndex(m => m.id === messageId);
        if (idx >= 0) {
          this.messages = this.messages.map((m, i) =>
            i === idx ? { ...m, isRead: true } : m
          );
        }
      } catch (error) {
        if (error.status === 401 && !hasToken()) {
          clearToken();
          this.showAuthModal = true;
        } else {
          this.detailError = error.message;
        }
      } finally {
        this.loadingDetail = false;
      }
    },

    async handleSearch(query) {
      this.searchQuery = query;
      // Reset other filters? Maybe keep tag filter?
      // Usually search is global or within context.
      // D1 query supports combining.
      this.nextBefore = null;
      await this.loadMessages(true);
    },

    async handleTagSelect(tag) {
      if (this.selectedTag === tag) {
        this.selectedTag = null; // Toggle off -> Go to Inbox
      } else {
        this.selectedTag = tag;
      }
      this.currentView = 'inbox';
      // Clear search when switching tags for fresh context
      this.searchQuery = '';

      // Switch to list view on mobile after selecting a tag
      if (this.isMobile) {
        this.mobileView = 'list';
      }

      await this.loadMessages(true);
    },

    async handleRefresh() {
      await this.loadMessages(true);
    },

    async handleLoadMore() {
      await this.loadMessages(false);
    },

    connectRealtime() {
      realtimeClient.on('message.received', this.handleMessageReceived);
      realtimeClient.on('message.tagged', this.handleMessageTagged);
      realtimeClient.connect();
    },

    handleMessageReceived(event) {
      console.log('New message received:', event);
      this.debouncedRefresh();
    },

    handleMessageTagged(event) {
      console.log('Message tagged:', event);

      const messageInList = this.messages.find(m => m.id === event.messageId);
      if (messageInList) {
        messageInList.tag = event.tag;
        messageInList.tagConfidence = event.tagConfidence;
      }

      if (this.currentMessage && this.currentMessage.id === event.messageId) {
        this.currentMessage.tag = event.tag;
        this.currentMessage.tagConfidence = event.tagConfidence;
      }
    },

    handleMessageArchived(messageId) {
      // Remove the archived message from the list
      this.messages = this.messages.filter(m => m.id !== messageId);
      this.loadCounts();

      // Clear the current message view
      if (this.currentMessage && this.currentMessage.id === messageId) {
        this.currentMessage = null;
        this.selectedMessageId = null;

        // On mobile, go back to list view after archiving
        if (this.isMobile) {
          this.mobileView = 'list';
        }
      }

      // Select the next message if available (only on desktop)
      if (!this.isMobile && this.messages.length > 0 && !this.selectedMessageId) {
        this.handleSelectMessage(this.messages[0].id);
      }
    },

    handleMessageSnoozed(messageId) {
      this.messages = this.messages.filter(m => m.id !== messageId);
      this.loadCounts();

      if (this.currentMessage && this.currentMessage.id === messageId) {
        this.currentMessage = null;
        this.selectedMessageId = null;

        if (this.isMobile) {
          this.mobileView = 'list';
        }
      }

      if (!this.isMobile && this.messages.length > 0 && !this.selectedMessageId) {
        this.handleSelectMessage(this.messages[0].id);
      }
    },

    async handleMessageDropped({ messageId, newTag }) {
      // Update the message tag in the local state
      const messageInList = this.messages.find(m => m.id === messageId);
      if (messageInList) {
        messageInList.tag = newTag;
      }

      // Update current message if it's the one being moved
      if (this.currentMessage && this.currentMessage.id === messageId) {
        this.currentMessage.tag = newTag;
      }

      // Refresh message counts to reflect the change
      await this.loadCounts();
    },

    handleDropError({ messageId, error }) {
      console.error('Failed to drop message:', error);
      // Show error toast
      if (this.$refs.toast) {
        this.$refs.toast.show('Failed to move email. Please try again.', 'error');
      }
    },

    openSettings() {
      this.showSettingsModal = true;
    },

    closeSettings() {
      this.showSettingsModal = false;
    },

    openCompose() {
      this.replyToMessage = null;
      this.forwardMessage = null;
      this.showComposeModal = true;
      // Close mobile sidebar if open
      if (this.isMobile) {
        this.mobileView = 'list';
      }
    },

    handleReply(message) {
      this.replyToMessage = message;
      this.forwardMessage = null;
      this.showComposeModal = true;
    },

    handleForward(message) {
      this.forwardMessage = message;
      this.replyToMessage = null;
      this.showComposeModal = true;
    },

    handleComposeClose() {
      this.showComposeModal = false;
      this.replyToMessage = null;
      this.forwardMessage = null;
    },

    handleEmailSent() {
      this.$refs.toast?.success('Email sent successfully');
      // Refresh messages if viewing the Sent folder
      if (this.selectedTag === 'sent') {
        this.loadMessages(true);
      }
      this.loadCounts();
    },

    handleTodoistAdded({ messageId, projectName }) {
      this.$refs.toast?.success(`Added to ${projectName}`);
      const msg = this.messages.find(m => m.id === messageId);
      if (msg) {
        msg.todoistProjectName = projectName;
      }
      if (this.currentMessage?.id === messageId) {
        this.currentMessage = { ...this.currentMessage, todoistProjectName: projectName };
      }
    },

    checkMobile() {
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = setTimeout(() => {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;

        // Handle viewport transitions
        if (wasMobile && !this.isMobile) {
          // Transitioning from mobile to desktop - reset to default view
          this.mobileView = 'list';
        } else if (!wasMobile && this.isMobile) {
          // Transitioning from desktop to mobile - show list by default
          this.mobileView = 'list';
        }
      }, 150);
    },

    openMobileSidebar() {
      if (this.isMobile) {
        this.mobileView = 'sidebar';
      }
    },

    handleMobileBack() {
      if (this.isMobile) {
        this.mobileView = 'list';
      }
    },

    closeMobileSidebar() {
      if (this.isMobile) {
        this.mobileView = 'list';
      }
    },

    startResize(which, event) {
      this.resizing = which;
      this.resizeStartX = event.clientX;
      this.resizeStartSidebar = this.sidebarWidth;
      this.resizeStartList = this.listWidth;
      window.addEventListener('mousemove', this.doResize);
      window.addEventListener('mouseup', this.stopResize);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    doResize(event) {
      if (!this.resizing) return;
      const dx = event.clientX - this.resizeStartX;
      if (this.resizing === 'sidebar') {
        const w = Math.max(160, Math.min(400, this.resizeStartSidebar + dx));
        this.sidebarWidth = w;
      } else if (this.resizing === 'list') {
        const w = Math.max(280, Math.min(600, this.resizeStartList + dx));
        this.listWidth = w;
      }
    },
    stopResize() {
      if (this.resizing) {
        localStorage.setItem('sidebar-width', String(this.sidebarWidth));
        localStorage.setItem('list-width', String(this.listWidth));
      }
      this.resizing = null;
      window.removeEventListener('mousemove', this.doResize);
      window.removeEventListener('mouseup', this.stopResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    },
    handleKeydown(event) {
      // Skip if user is typing in an input field
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
        return;
      }

      // Skip if modal is open or no messages
      if (this.showAuthModal || this.messages.length === 0) {
        return;
      }

      // Only handle arrow keys
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      event.preventDefault();

      const currentIndex = this.messages.findIndex(m => m.id === this.selectedMessageId);

      if (event.key === 'ArrowDown') {
        // Move to next message
        const nextIndex = currentIndex < this.messages.length - 1 ? currentIndex + 1 : currentIndex;
        if (nextIndex !== currentIndex) {
          this.handleSelectMessage(this.messages[nextIndex].id);
        }
      } else if (event.key === 'ArrowUp') {
        // Move to previous message
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        if (prevIndex !== currentIndex || currentIndex === -1) {
          this.handleSelectMessage(this.messages[prevIndex].id);
        }
      }
    }
  }
};
</script>

<style scoped>
#app {
  height: 100vh;
  overflow: hidden;
}

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-container {
  display: grid;
  flex: 1;
  min-height: 0;
}

/* Ensure grid items are constrained to enable inner scrolling */
.sidebar-panel,
.list-panel,
.detail-panel,
.kanban-panel,
.right-sidebar-panel {
  min-height: 0;
  overflow: hidden;
}

.resize-handle {
  width: 4px;
  min-width: 4px;
  cursor: col-resize;
  background: var(--color-border);
  flex-shrink: 0;
  transition: background 0.15s;
}

.resize-handle:hover {
  background: var(--color-primary);
}

.resize-handle:active {
  background: var(--color-primary);
}

@media (max-width: 768px) {
  .app-container {
    grid-template-columns: 1fr;
    position: relative;
  }

  .settings-panel {
    grid-column: 1 / -1;
    display: flex;
  }

  /* Hide all panels by default on mobile */
  .sidebar-panel,
  .list-panel,
  .detail-panel {
    display: none;
  }

  /* Show only the active panel based on mobile view */
  .app-container.mobile-view-sidebar .sidebar-panel {
    display: flex;
  }

  .app-container.mobile-view-list .list-panel {
    display: flex;
  }

  .app-container.mobile-view-detail .detail-panel {
    display: flex;
  }

  .right-sidebar-panel {
    display: none;
  }
}
</style>
