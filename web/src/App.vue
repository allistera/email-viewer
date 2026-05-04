<template>
  <div id="app" class="min-h-screen">
    <AuthModal
      :show="showAuthModal"
      :error-message="authError"
      @submit="handleAuthSubmit"
    />

    <ComposeModal
      ref="composeModal"
      :show="showComposeModal"
      :reply-to="replyToMessage"
      :forward-from="forwardMessage"
      :draft="composeDraft"
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
      @close="showSettingsModal = false; todoistEnabled = hasTodoistToken()"
    />

    <div v-if="!showAuthModal" class="app-layout">
      <!-- Top Navigation Bar -->
      <TopBar
        :page-title="pageTitle"
        :search-query="searchQuery"
        :is-mobile="isMobile"
        @toggle-sidebar="toggleMobileSidebar"
        @search="handleSearch"
        @compose="openCompose"
        @refresh="handleRefresh"
        @settings="openSettings"
      />

      <div class="app-container" :class="mobileViewClass" :style="gridStyle">
        <!-- Left Sidebar -->
        <DiscordSidebar
          ref="sidebar"
          :selected-tag="selectedTag"
          :message-counts="sidebarCounts"
          :settings-active="showSettingsModal"
          class="sidebar-panel"
          @select="handleTagSelect"
          @settings="openSettings"
          @close="closeMobileSidebar"
          @compose="openCompose"
          @message-dropped="handleMessageDropped"
        />

        <template v-if="currentView === 'settings'">
          <SettingsView class="settings-panel" @close="closeSettings" />
        </template>
        <template v-else>
          <DraftsList
            v-if="selectedTag === 'drafts'"
            v-show="(rightRailView !== 'calendar' && rightRailView !== 'settings') || isMobile"
            :drafts="drafts"
            class="list-panel"
            @open="openDraft"
            @delete="handleDeleteDraft"
            @open-sidebar="openMobileSidebar"
          />
          <MessageList
            v-else
            v-show="(rightRailView !== 'calendar' && rightRailView !== 'settings') || isMobile"
            :messages="messages"
            :selected-id="selectedMessageId"
            :selected-ids="selectedMessageIds"
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
            @bulk-archive="handleBulkArchive"
            @toggle-select="handleToggleSelect"
          />

          <div
            v-if="!isMobile && rightRailView !== 'calendar'"
            class="resize-handle resize-handle-list"
            aria-label="Resize message list"
            @mousedown.prevent="startResize('list', $event)"
          />

          <SettingsView
            v-if="rightRailView === 'settings' && !isMobile"
            class="settings-panel"
            @close="rightRailView = 'email'"
          />
          <CalendarView
            v-else-if="rightRailView === 'calendar' && !isMobile"
            class="calendar-panel"
          />
          <KanbanView
            v-else-if="rightRailView === 'kanban' && !isMobile"
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
            :todoist-enabled="todoistEnabled"
            class="detail-panel"
            @archived="handleMessageArchived"
            @snoozed="handleMessageSnoozed"
            @back="handleMobileBack"
            @reply="handleReply"
            @forward="handleForward"
            @todoist-failed="todoistEnabled = false"
          />
        </template>

        <RightSidebar
          class="right-sidebar-panel"
          :active-view="rightRailView"
          :todoist-open="showTodoistSlideout"
          :todoist-enabled="todoistEnabled"
          @select="rightRailView = $event"
          @toggle-todoist="showTodoistSlideout = !showTodoistSlideout"
        />
      </div>

      <button
        v-if="!showAuthModal"
        class="compose-fab"
        aria-label="Compose new email"
        title="Compose (⌘N)"
        @click="openCompose"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>

      <nav v-if="isMobile" class="mobile-tab-bar" aria-label="App navigation">
        <button
          class="tab-btn"
          :class="{ active: mobileView === 'sidebar' }"
          @click="openMobileSidebar"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
            <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>Menu</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: mobileView === 'list' || mobileView === 'detail' }"
          @click="closeMobileSidebar"
          aria-label="Go to inbox"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
            <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <path d="M22 6L12 13 2 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Inbox</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<script>
import AuthModal from './components/AuthModal.vue';
import TopBar from './components/TopBar.vue';
import DiscordSidebar from './components/DiscordSidebar.vue';
import MessageList from './components/MessageList.vue';
import MessageDetail from './components/MessageDetail.vue';
import SettingsView from './components/SettingsView.vue';
import ComposeModal from './components/ComposeModal.vue';
import DraftsList from './components/DraftsList.vue';
import ToastNotification from './components/ToastNotification.vue';
import RightSidebar from './components/RightSidebar.vue';
import KanbanView from './components/KanbanView.vue';
import CalendarView from './components/CalendarView.vue';
import TodoistSlideout from './components/TodoistSlideout.vue';
import SettingsModal from './components/SettingsModal.vue';
import { hasToken, setToken, clearToken, hasTodoistToken } from './services/auth.js';
import { getMessages, getMessage, getMessageCounts, archiveMessage } from './services/api.js';
import { listDrafts, deleteDraft, migrateLegacyDraft } from './services/drafts.js';
import { init as initTheme } from './services/theme.js';
import { realtimeClient } from './services/realtime.js';
import { debounce } from './utils/debounce.js';

export default {
  name: 'App',
  components: {
    AuthModal,
    TopBar,
    DiscordSidebar,
    MessageList,
    MessageDetail,
    SettingsView,
    ComposeModal,
    DraftsList,
    ToastNotification,
    RightSidebar,
    KanbanView,
    CalendarView,
    TodoistSlideout,
    SettingsModal
  },
  data() {
    return {
      showAuthModal: !hasToken(),
      messages: [],
      currentMessage: null,
      selectedMessageId: null,
      selectedMessageIds: [],
      lastBulkSelectIndex: -1,
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
      composeDraft: null,
      drafts: [],
      messageCounts: null,
      rightRailView: 'email',
      todoistEnabled: hasTodoistToken(),
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
      if (this.isMobile) return {};
      if (this.currentView === 'settings') {
        return {
          gridTemplateColumns: `${this.sidebarWidth}px 1fr 4px ${this.rightSidebarWidth}px`
        };
      }
      if (this.rightRailView === 'calendar' || this.rightRailView === 'settings') {
        return {
          gridTemplateColumns: `${this.sidebarWidth}px 1fr ${this.rightSidebarWidth}px`
        };
      }
      return {
        gridTemplateColumns: `${this.sidebarWidth}px ${this.listWidth}px 4px 1fr ${this.rightSidebarWidth}px`
      };
    },
    mobileViewClass() {
      if (!this.isMobile) return '';
      return `mobile-view-${this.mobileView}`;
    },
    pageTitle() {
      return 'Email';
    },
    sidebarCounts() {
      const base = this.messageCounts || {};
      return { ...base, drafts: this.drafts.length };
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
    migrateLegacyDraft();
    this.refreshDrafts();
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
    normalizeKanbanLaneTag(tag) {
      const raw = String(tag || '').trim().toLowerCase();
      if (!raw) return null;
      if (raw === 'todo' || raw === 'to-do') return 'todo';
      if (raw === 'in-progress' || raw === 'in progress' || raw === 'inprogress') return 'in-progress';
      if (raw === 'done') return 'done';
      return null;
    },

    isKanbanLaneTag(tag) {
      return this.normalizeKanbanLaneTag(tag) !== null;
    },

    applyKanbanLane(message, newTag) {
      const canonicalNewTag = this.normalizeKanbanLaneTag(newTag);
      if (!message || !canonicalNewTag) return;

      const existingTags = Array.isArray(message.tags) ? message.tags.filter(Boolean) : [];
      const nonLaneTags = existingTags.filter((tag) => !this.isKanbanLaneTag(tag));
      message.tags = [...new Set([...nonLaneTags, canonicalNewTag])];

      // Keep existing non-kanban primary tag. If the primary tag is a lane tag, switch it.
      if (!message.tag || this.isKanbanLaneTag(message.tag)) {
        const primaryNonLane = nonLaneTags.find((tag) => !this.isKanbanLaneTag(tag)) || null;
        message.tag = primaryNonLane || canonicalNewTag;
      }
    },

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
      if (this.selectedTag === 'drafts') {
        if (reset) {
          this.messages = [];
          this.nextBefore = null;
          this.hasMore = false;
          this.listError = null;
        }
        this.loadingMessages = false;
        this.loadingMore = false;
        return;
      }
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
        } else if (this.selectedTag === 'all') {
           // No filters, load everything
        } else if (this.selectedTag) {
          params.tag = this.selectedTag;
          // Exclude archived by default unless viewing archive
          params.archived = false;
        } else {
          // Inbox view (no specific tag selected)
          // Exclude archived, spam, and sent emails
          params.archived = false;
          params.excludeTag = 'Spam,Sent';
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
      this.selectedMessageIds = [];
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
      realtimeClient.on('snooze.wakeup', this.handleSnoozeWakeup);
      realtimeClient.connect();
    },

    handleSnoozeWakeup() {
      this.debouncedRefresh();
      this.loadCounts();
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

      // Select the next unread message if available, otherwise the first message (only on desktop)
      if (!this.isMobile && this.messages.length > 0 && !this.selectedMessageId) {
        const nextUnread = this.messages.find(m => !m.is_read);
        this.handleSelectMessage((nextUnread || this.messages[0]).id);
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

    handleToggleSelect(messageId, event) {
      const index = this.messages.findIndex(m => m.id === messageId);
      const isSelected = this.selectedMessageIds.includes(messageId);

      if (event?.shiftKey && this.lastBulkSelectIndex >= 0 && index >= 0) {
        const start = Math.min(this.lastBulkSelectIndex, index);
        const end = Math.max(this.lastBulkSelectIndex, index);
        const rangeIds = this.messages.slice(start, end + 1).map(m => m.id);
        const addToSelection = !isSelected;
        if (addToSelection) {
          const combined = new Set([...this.selectedMessageIds, ...rangeIds]);
          this.selectedMessageIds = [...combined];
        } else {
          const rangeSet = new Set(rangeIds);
          this.selectedMessageIds = this.selectedMessageIds.filter(id => !rangeSet.has(id));
        }
      } else {
        if (isSelected) {
          this.selectedMessageIds = this.selectedMessageIds.filter(id => id !== messageId);
        } else {
          this.selectedMessageIds = [...this.selectedMessageIds, messageId];
        }
        this.lastBulkSelectIndex = index;
      }
    },

    async handleBulkArchive(messageIds) {
      if (!messageIds || messageIds.length === 0) return;

      const idsToArchive = [...messageIds];
      this.selectedMessageIds = [];

      // Archive all messages in parallel
      await Promise.allSettled(idsToArchive.map(id => archiveMessage(id)));

      // Remove from list
      this.messages = this.messages.filter(m => !idsToArchive.includes(m.id));
      this.loadCounts();

      // Clear current message if it was in the selection
      if (this.currentMessage && idsToArchive.includes(this.currentMessage.id)) {
        this.currentMessage = null;
        this.selectedMessageId = null;
        if (this.isMobile) {
          this.mobileView = 'list';
        }
      }

      // Select first remaining message on desktop
      if (!this.isMobile && this.messages.length > 0 && !this.selectedMessageId) {
        this.handleSelectMessage(this.messages[0].id);
      }

      this.$refs.toast?.success(`Archived ${idsToArchive.length} email${idsToArchive.length !== 1 ? 's' : ''}`);
    },

    async handleMessageDropped({ messageId, newTag }) {
      console.log('handleMessageDropped called:', { messageId, newTag });

      // Reload messages to get updated tags from database
      await this.loadMessages();

      console.log('Messages after reload:', this.messages.length);
      const droppedMessage = this.messages.find(m => m.id === messageId);
      console.log('Dropped message after reload:', droppedMessage);

      await this.loadCounts();

      // If the dropped message is currently selected, reload it to show updated tags
      if (this.currentMessage && this.currentMessage.id === messageId) {
        await this.loadMessage(messageId);
      }
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
      this.currentView = 'inbox';
    },

    openCompose() {
      // If already open and minimized, just restore it
      if (this.showComposeModal && this.$refs.composeModal?.isMinimized) {
        this.$refs.composeModal.isMinimized = false;
        return;
      }
      this.replyToMessage = null;
      this.forwardMessage = null;
      this.composeDraft = null;
      this.showComposeModal = true;
      // Close mobile sidebar if open
      if (this.isMobile) {
        this.mobileView = 'list';
      }
    },

    openDraft(draft) {
      this.replyToMessage = null;
      this.forwardMessage = null;
      this.composeDraft = draft;
      this.showComposeModal = true;
      if (this.isMobile) {
        this.mobileView = 'list';
      }
    },

    handleDeleteDraft(id) {
      deleteDraft(id);
      this.refreshDrafts();
    },

    refreshDrafts() {
      this.drafts = listDrafts();
    },

    handleReply(message) {
      this.replyToMessage = message;
      this.forwardMessage = null;
      this.composeDraft = null;
      this.showComposeModal = true;
    },

    handleForward(message) {
      this.forwardMessage = message;
      this.replyToMessage = null;
      this.composeDraft = null;
      this.showComposeModal = true;
    },

    handleComposeClose() {
      this.showComposeModal = false;
      this.replyToMessage = null;
      this.forwardMessage = null;
      this.composeDraft = null;
      this.refreshDrafts();
    },

    handleEmailSent() {
      this.$refs.toast?.success('Email sent successfully');
      // Refresh messages if viewing the Sent folder
      if (this.selectedTag === 'sent') {
        this.loadMessages(true);
      }
      this.loadCounts();
      this.refreshDrafts();
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

    toggleMobileSidebar() {
      if (this.isMobile) {
        this.mobileView = this.mobileView === 'sidebar' ? 'list' : 'sidebar';
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

      // Cmd+N (Mac) or Ctrl+N: open compose window
      if (event.key === 'n' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        this.openCompose();
        return;
      }

      // Skip if modal is open or no messages
      if (this.showAuthModal || this.messages.length === 0) {
        return;
      }

      // Cmd+A (Mac) or Ctrl+A: select all displayed messages
      if (event.key === 'a' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        this.selectedMessageIds = this.messages.map(m => m.id);
        return;
      }

      // Escape: clear multi-selection
      if (event.key === 'Escape' && this.selectedMessageIds.length > 0) {
        this.selectedMessageIds = [];
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
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-container {
  display: grid;
  grid-template-columns: 240px 1fr;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Ensure grid items are constrained to enable inner scrolling */
.sidebar-panel,
.list-panel,
.detail-panel,
.kanban-panel,
.calendar-panel,
.right-sidebar-panel {
  min-height: 0;
  overflow: hidden;
}

.resize-handle {
  width: 4px;
  min-width: 4px;
  cursor: col-resize;
  /* Default to transparent so there's no visible gap
     between panels; highlight only on hover/active. */
  background: transparent;
  flex-shrink: 0;
  transition: background 0.15s;
}

.resize-handle:hover {
  background: var(--color-primary);
}

.resize-handle:active {
  background: var(--color-primary);
}

/* Mobile bottom tab bar */
.mobile-tab-bar {
  display: flex;
  align-items: stretch;
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 10px 4px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.tab-btn.active {
  color: var(--color-primary);
}

.tab-btn svg {
  flex-shrink: 0;
}

.compose-fab {
  position: fixed;
  bottom: 96px;
  right: calc(72px + 96px);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
}

.compose-fab:hover {
  background: var(--color-primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}

.compose-fab:active {
  transform: translateY(0);
}

@media (max-width: 768px) {
  #app,
  .app-layout {
    height: 100dvh;
  }

  .app-container {
    grid-template-columns: 1fr !important;
    position: relative;
    background: linear-gradient(180deg, var(--color-bg-secondary) 0%, var(--color-bg) 120px);
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

  .mobile-tab-bar {
    background: color-mix(in srgb, var(--color-bg) 88%, transparent);
    backdrop-filter: blur(10px);
    border-top-color: color-mix(in srgb, var(--color-border) 80%, transparent);
    padding-top: 2px;
  }

  .tab-btn {
    font-size: 10px;
    letter-spacing: 0.01em;
  }

  .tab-btn.active {
    color: var(--color-primary);
    text-shadow: 0 0 0.01px currentColor;
  }

  .compose-fab {
    right: 24px;
    bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
