<template>
  <div id="app">
    <AuthModal
      :show="showAuthModal"
      :error-message="authError"
      @submit="handleAuthSubmit"
    />

    <div v-if="!showAuthModal" class="app-layout">
      <div class="app-container">
        <TagSidebar
          ref="sidebar"
          :selected-tag="selectedTag"
          @select="handleTagSelect"
        />

        <MessageList
          :messages="messages"
          :selected-id="selectedMessageId"
          :loading="loadingMessages"
          :loading-more="loadingMore"
          :has-more="hasMore"
          :error="listError"
          @select="handleSelectMessage"
          @filter-change="handleFilterChange"
          @refresh="handleRefresh"
          @load-more="handleLoadMore"
        />

        <MessageDetail
          :message="currentMessage"
          :loading="loadingDetail"
          :error="detailError"
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
import { hasToken, setToken, clearToken } from './services/auth.js';
import { getMessages, getMessage, archiveMessage, createTag } from './services/api.js';
import { realtimeClient } from './services/realtime.js';

export default {
  name: 'App',
  components: {
    AuthModal,
    TagSidebar,
    MessageList,
    MessageDetail
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
      authError: ''
    };
  },
  mounted() {
    if (!this.showAuthModal) {
      this.init();
    }
  },
  beforeUnmount() {
    realtimeClient.disconnect();
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

        if (reset && this.messages.length > 0 && !this.selectedMessageId) {
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

    async handleTagSelect(tag) {
      if (this.selectedTag === tag) {
        this.selectedTag = null; // Toggle off -> Go to Inbox
      } else {
        this.selectedTag = tag;
        // When selecting a sidebar folder, we reset any local list filters to default
        this.tagFilter = 'all'; 
      }
      await this.loadMessages(true);
    },

    async handleCreateTag(tagName) {
      this.showTagModal = false;
      try {
        await createTag(tagName);
        await this.$refs.sidebar.loadTags();
      } catch (e) {
        alert('Failed to create tag');
      }
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

    async handleArchive() {
      if (!this.selectedMessageId) return;

      try {
        await archiveMessage(this.selectedMessageId);

        this.messages = this.messages.filter(m => m.id !== this.selectedMessageId);

        if (this.currentMessage && this.currentMessage.id === this.selectedMessageId) {
          this.currentMessage = null;
          this.selectedMessageId = null;
        }

        if (this.messages.length > 0 && !this.selectedMessageId) {
          this.handleSelectMessage(this.messages[0].id);
        }
      } catch (error) {
        alert('Failed to archive message: ' + error.message);
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

@media (max-width: 768px) {
  .app-container {
    grid-template-columns: 1fr;
  }
}
</style>
