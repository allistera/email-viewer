<template>
  <div id="app">
    <AuthModal
      :show="showAuthModal"
      :error-message="authError"
      @submit="handleAuthSubmit"
    />

    <div v-if="!showAuthModal" class="app-layout">
      <div class="app-container" :class="mobileViewClass">
        <TagSidebar
          ref="sidebar"
          class="sidebar-panel"
          :class="{ 'mobile-visible': mobileView === 'sidebar' }"
          :selected-tag="selectedTag"
          :settings-active="currentView === 'settings'"
          @select="handleTagSelectMobile"
          @settings="openSettingsMobile"
        />

        <template v-if="currentView === 'settings'">
          <SettingsView 
            class="settings-panel" 
            :class="{ 'mobile-visible': mobileView === 'list' || mobileView === 'detail' }"
            @close="closeSettingsMobile" 
          />
        </template>
        <template v-else>
          <MessageList
            class="list-panel"
            :class="{ 'mobile-visible': mobileView === 'list' }"
            :messages="messages"
            :selected-id="selectedMessageId"
            :loading="loadingMessages"
            :loading-more="loadingMore"
            :has-more="hasMore"
            :error="listError"
            @select="handleSelectMessageMobile"
            @filter-change="handleFilterChange"
            @search="handleSearch"
            @load-more="handleLoadMore"
          />

          <MessageDetail
            class="detail-panel"
            :class="{ 'mobile-visible': mobileView === 'detail' }"
            :message="currentMessage"
            :loading="loadingDetail"
            :error="detailError"
            @archived="handleMessageArchivedMobile"
            @back="handleBackToList"
          />
        </template>
      </div>

      <!-- Mobile Bottom Navigation -->
      <nav class="mobile-nav" aria-label="Mobile navigation">
        <button 
          class="mobile-nav-btn" 
          :class="{ active: mobileView === 'sidebar' }"
          @click="setMobileView('sidebar')"
          aria-label="Tags"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <span class="nav-label">Tags</span>
        </button>
        <button 
          class="mobile-nav-btn" 
          :class="{ active: mobileView === 'list' && currentView !== 'settings' }"
          @click="goToInbox"
          aria-label="Inbox"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
            <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
          </svg>
          <span class="nav-label">Inbox</span>
        </button>
        <button 
          class="mobile-nav-btn" 
          :class="{ active: currentView === 'settings' }"
          @click="openSettingsMobile"
          aria-label="Settings"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          <span class="nav-label">Settings</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<script>
import AuthModal from './components/AuthModal.vue';
import TagSidebar from './components/TagSidebar.vue';
import MessageList from './components/MessageList.vue';
import MessageDetail from './components/MessageDetail.vue';
import SettingsView from './components/SettingsView.vue';
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
    SettingsView
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
      tagFilter: 'all',
      selectedTag: null,
      searchQuery: '',
      authError: '',
      currentView: 'inbox',
      pendingDeepLinkId: null,
      mobileView: 'list', // 'sidebar', 'list', 'detail'
      isMobile: false
    };
  },
  computed: {
    mobileViewClass() {
      return this.isMobile ? `mobile-active-${this.mobileView}` : '';
    }
  },
  mounted() {
    this.checkMobile();
    window.addEventListener('resize', this.checkMobile);
    if (!this.showAuthModal) {
      this.pendingDeepLinkId = this.getDeepLinkMessageId();
      this.init();
    }
  },
  beforeUnmount() {
    realtimeClient.disconnect();
    window.removeEventListener('resize', this.checkMobile);
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
           params.tag = 'Spam'; // DB tag name is title case usually, but search likely case insensitive or exact. "Spam" is seeded.
        } else if (this.selectedTag) {
          params.tag = this.selectedTag;
          // Exclude archived by default unless viewing archive
          params.archived = false; 
        } else {
          // Inbox view (no specific tag selected)
          // Default filter logic (e.g. all non-spam, non-archived)
          if (this.tagFilter === 'spam') {
             params.tag = 'Spam';
          } else if (this.tagFilter === 'not_spam') { // "All Messages" in UI dropdown maps here?
             params.excludeTag = 'Spam';
             params.archived = false;
          } else {
             // 'all' filter from dropdown
             params.archived = false;
          }
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

    async handleFilterChange(filter) {
      this.tagFilter = filter;
      this.selectedTag = null;
      await this.loadMessages(true);
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
        // When selecting a sidebar folder, we reset any local list filters to default
        this.tagFilter = 'all'; 
      }
      this.currentView = 'inbox';
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
      }

      // Select the next message if available
      if (this.messages.length > 0 && !this.selectedMessageId) {
        this.handleSelectMessage(this.messages[0].id);
      }
    },

    openSettings() {
      this.currentView = 'settings';
    },

    closeSettings() {
      this.currentView = 'inbox';
    },

    // Mobile-specific methods
    checkMobile() {
      this.isMobile = window.innerWidth <= 768;
    },

    setMobileView(view) {
      this.mobileView = view;
    },

    goToInbox() {
      this.currentView = 'inbox';
      this.mobileView = 'list';
    },

    handleTagSelectMobile(tag) {
      this.handleTagSelect(tag);
      if (this.isMobile) {
        this.mobileView = 'list';
      }
    },

    handleSelectMessageMobile(messageId) {
      this.handleSelectMessage(messageId);
      if (this.isMobile) {
        this.mobileView = 'detail';
      }
    },

    openSettingsMobile() {
      this.openSettings();
      if (this.isMobile) {
        this.mobileView = 'list'; // Show settings in main area
      }
    },

    closeSettingsMobile() {
      this.closeSettings();
      if (this.isMobile) {
        this.mobileView = 'list';
      }
    },

    handleMessageArchivedMobile(messageId) {
      this.handleMessageArchived(messageId);
      if (this.isMobile) {
        this.mobileView = 'list';
      }
    },

    handleBackToList() {
      this.mobileView = 'list';
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

.settings-panel {
  grid-column: 2 / 4;
}

/* Mobile Navigation Bar */
.mobile-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  padding: 8px 0;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  z-index: 100;
}

.mobile-nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: color 0.2s;
}

.mobile-nav-btn.active {
  color: var(--color-primary);
}

.mobile-nav-btn:hover {
  color: var(--color-text);
}

.nav-icon {
  width: 24px;
  height: 24px;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
}

/* Medium screens - hide sidebar by default, 2-column layout */
@media (max-width: 1024px) {
  .app-container {
    grid-template-columns: 200px 1fr;
  }

  .detail-panel {
    display: none;
  }

  .app-container.mobile-active-detail .detail-panel {
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
  }
}

/* Mobile layout */
@media (max-width: 768px) {
  .app-container {
    grid-template-columns: 1fr;
  }

  .app-layout {
    padding-bottom: 70px; /* Space for bottom nav */
  }

  .mobile-nav {
    display: flex;
  }

  /* Hide all panels by default on mobile */
  .sidebar-panel,
  .list-panel,
  .detail-panel,
  .settings-panel {
    display: none;
  }

  /* Show the active panel */
  .sidebar-panel.mobile-visible,
  .list-panel.mobile-visible,
  .detail-panel.mobile-visible,
  .settings-panel.mobile-visible {
    display: flex;
  }

  .settings-panel {
    grid-column: 1;
  }
}
</style>
