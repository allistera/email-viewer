<template>
  <div id="app">
    <AuthModal
      :show="showAuthModal"
      @submit="handleAuthSubmit"
    />

    <div v-if="!showAuthModal" class="app-container">
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
</template>

<script>
import AuthModal from './components/AuthModal.vue';
import MessageList from './components/MessageList.vue';
import MessageDetail from './components/MessageDetail.vue';
import { hasToken, setToken, clearToken } from './services/auth.js';
import { getMessages, getMessage } from './services/api.js';
import { realtimeClient } from './services/realtime.js';

export default {
  name: 'App',
  components: {
    AuthModal,
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
      spamFilter: 'all'
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
      setToken(token);

      try {
        await this.loadMessages();
        this.showAuthModal = false;
        this.connectRealtime();
      } catch (error) {
        clearToken();
        alert('Invalid token. Please try again.');
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
          limit: 50,
          spamStatus: this.spamFilter === 'all' ? null : this.spamFilter
        };

        if (!reset && this.nextBefore) {
          params.before = this.nextBefore;
        }

        const response = await getMessages(params);

        if (reset) {
          this.messages = response.items;
        } else {
          this.messages = [...this.messages, ...response.items];
        }

        this.nextBefore = response.nextBefore;
        this.hasMore = response.items.length === params.limit && response.nextBefore !== null;

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
        if (error.status === 401) {
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
      this.spamFilter = filter;
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
      realtimeClient.on('message.classified', this.handleMessageClassified);
      realtimeClient.connect();
    },

    handleMessageReceived(event) {
      console.log('New message received:', event);
      this.handleRefresh();
    },

    handleMessageClassified(event) {
      console.log('Message classified:', event);

      const messageInList = this.messages.find(m => m.id === event.messageId);
      if (messageInList) {
        messageInList.spamStatus = event.spamStatus;
        messageInList.spamConfidence = event.spamConfidence;
      }

      if (this.currentMessage && this.currentMessage.id === event.messageId) {
        this.currentMessage.spamStatus = event.spamStatus;
        this.currentMessage.spamConfidence = event.spamConfidence;
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

.app-container {
  display: grid;
  grid-template-columns: 400px 1fr;
  height: 100vh;
}

@media (max-width: 768px) {
  .app-container {
    grid-template-columns: 1fr;
  }
}
</style>
