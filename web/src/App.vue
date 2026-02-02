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

    <div v-if="!showAuthModal" class="app-layout">
      <div class="app-container" :class="mobileViewClass">
        <TagSidebar
          ref="sidebar"
          :selected-tag="selectedTag"
          :settings-active="currentView === 'settings'"
          class="sidebar-panel"
          @select="handleTagSelect"
          @settings="openSettings"
          @close="closeMobileSidebar"
          @compose="openCompose"
        />

        <template v-if="currentView === 'settings'">
          <SettingsView class="settings-panel" @close="closeSettings" />
        </template>
        <template v-else>
          <MessageList
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

          <MessageDetail
            :message="currentMessage"
            :loading="loadingDetail"
            :error="detailError"
            class="detail-panel"
            @archived="handleMessageArchived"
            @back="handleMobileBack"
            @reply="handleReply"
            @forward="handleForward"
          />
        </template>
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
import ComposeModal from './components/ComposeModal.vue';
import { hasToken, setToken, clearToken } from './services/auth.js';
import { getMessages, getMessage } from './services/api.js';
import { realtimeClient } from './services/realtime.js';

export default {
  name: 'App',
  components: {
    AuthModal,
    TagSidebar,
    MessageList,
    MessageDetail,
    SettingsView,
    ComposeModal
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
      forwardMessage: null
    };
  },
  computed: {
    mobileViewClass() {
      if (!this.isMobile) return '';
      return `mobile-view-${this.mobileView}`;
    }
  },
  mounted() {
    if (!this.showAuthModal) {
      this.pendingDeepLinkId = this.getDeepLinkMessageId();
      this.init();
    }
    // Initial check without debounce
    this.isMobile = window.innerWidth <= 768;
    window.addEventListener('resize', this.checkMobile);
    window.addEventListener('keydown', this.handleKeydown);
  },
  beforeUnmount() {
    realtimeClient.disconnect();
    window.removeEventListener('resize', this.checkMobile);
    window.removeEventListener('keydown', this.handleKeydown);
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
  },
  methods: {
    async init() {
      await this.loadMessages();
      this.connectRealtime();
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
        } else if (this.selectedTag) {
          params.tag = this.selectedTag;
          // Exclude archived by default unless viewing archive
          params.archived = false; 
        } else {
          // Inbox view (no specific tag selected)
          // Exclude archived and spam emails
          params.archived = false;
          params.excludeTag = 'Spam';
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
      this.handleRefresh();
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

    openSettings() {
      this.currentView = 'settings';
      // On mobile, switch to list view to show settings (which takes list+detail space)
      if (this.isMobile) {
        this.mobileView = 'list';
      }
    },

    closeSettings() {
      this.currentView = 'inbox';
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
      // Could show a success notification here
      console.log('Email sent successfully');
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
  grid-template-columns: 220px 360px 1fr;
  flex: 1;
  min-height: 0;
}

/* Ensure grid items are constrained to enable inner scrolling */
.sidebar-panel,
.list-panel,
.detail-panel {
  min-height: 0;
  overflow: hidden;
}

.settings-panel {
  grid-column: 2 / 4;
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
}
</style>
