<template>
  <div v-if="show" class="modal-overlay">
    <div class="compose-modal">
      <div class="compose-header">
        <h2>{{ replyTo ? 'Reply' : forwardFrom ? 'Forward' : 'New Message' }}</h2>
        <button class="close-btn" @click="handleClose" title="Close">&times;</button>
      </div>

      <form @submit.prevent="handleSend" class="compose-form">
        <div class="form-field to-field">
          <label for="compose-to">To</label>
          <div class="autocomplete-wrapper">
            <input
              id="compose-to"
              ref="toInput"
              v-model="to"
              type="email"
              placeholder="recipient@example.com"
              required
              :disabled="sending"
              @input="handleToInput"
              @keydown="handleToKeydown"
              @blur="handleToBlur"
              @focus="handleToFocus"
              autocomplete="off"
            />
            <ul v-if="showSuggestions && suggestions.length > 0" class="suggestions-dropdown">
              <li
                v-for="(contact, index) in suggestions"
                :key="contact.email"
                :class="{ active: index === selectedSuggestionIndex }"
                @mousedown.prevent="selectSuggestion(contact)"
                @mouseover="selectedSuggestionIndex = index"
              >
                {{ contact.email }}
              </li>
            </ul>
          </div>
        </div>

        <div class="form-field">
          <label for="compose-subject">Subject</label>
          <input
            id="compose-subject"
            ref="subjectInput"
            v-model="subject"
            type="text"
            placeholder="Subject"
            :disabled="sending"
          />
        </div>

        <div class="form-field body-field">
          <label for="compose-body">Message</label>
          <textarea
            id="compose-body"
            ref="bodyInput"
            v-model="body"
            placeholder="Write your message..."
            :disabled="sending"
          ></textarea>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div class="compose-actions">
          <button type="button" class="btn-secondary" @click="handleClose" :disabled="sending">
            Cancel
          </button>
          <button type="submit" class="btn-primary" :disabled="sending || !to">
            {{ sending ? 'Sending...' : 'Send' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { sendEmail, searchContacts } from '../services/api.js';

export default {
  name: 'ComposeModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    replyTo: {
      type: Object,
      default: null
    },
    forwardFrom: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'sent'],
  data() {
    return {
      to: '',
      subject: '',
      body: '',
      sending: false,
      error: null,
      suggestions: [],
      showSuggestions: false,
      selectedSuggestionIndex: -1,
      searchTimeout: null
    };
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.resetForm();
        if (this.replyTo) {
          this.prefillReply();
          // Focus body when replying since subject is prefilled
          this.$nextTick(() => {
            const textarea = this.$refs.bodyInput;
            if (textarea) {
              textarea.focus();
              textarea.setSelectionRange(0, 0);
            }
          });
        } else if (this.forwardFrom) {
          this.prefillForward();
          // Focus To field when forwarding
          this.$nextTick(() => {
            this.$refs.toInput?.focus();
          });
        } else {
          // Focus To field for new messages since it's required
          this.$nextTick(() => {
            this.$refs.toInput?.focus();
          });
        }
        // Add escape key listener
        document.addEventListener('keydown', this.handleEscapeKey);
      } else {
        document.removeEventListener('keydown', this.handleEscapeKey);
      }
    }
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscapeKey);
  },
  methods: {
    resetForm() {
      this.to = '';
      this.subject = '';
      this.body = '';
      this.error = null;
      this.sending = false;
      this.suggestions = [];
      this.showSuggestions = false;
      this.selectedSuggestionIndex = -1;
    },
    prefillReply() {
      if (!this.replyTo) return;
      
      // Extract email from "Name <email>" format with robust handling
      const rawFrom = (this.replyTo.from || '').trim();
      if (rawFrom) {
        const fromMatch = rawFrom.match(/<([^>]+)>/);
        this.to = (fromMatch && fromMatch[1] ? fromMatch[1] : rawFrom).trim();
      } else {
        this.to = '';
      }
      
      // Add Re: prefix if not already present
      const subj = this.replyTo.subject || '';
      this.subject = subj.startsWith('Re:') ? subj : `Re: ${subj}`;
      
      // Quote the original message
      const date = this.formatDate(this.replyTo.receivedAt);
      const originalBody = this.replyTo.textBody || '';
      this.body = `\n\n---\nOn ${date}, ${this.replyTo.from} wrote:\n\n${originalBody}`;
    },
    prefillForward() {
      if (!this.forwardFrom) return;
      
      // Leave To empty for user to fill
      this.to = '';
      
      // Add Fwd: prefix if not already present
      const subj = this.forwardFrom.subject || '';
      this.subject = subj.startsWith('Fwd:') ? subj : `Fwd: ${subj}`;
      
      // Include forwarded message
      const date = this.formatDate(this.forwardFrom.receivedAt);
      const originalBody = this.forwardFrom.textBody || '';
      this.body = `\n\n---------- Forwarded message ----------\nFrom: ${this.forwardFrom.from}\nDate: ${date}\nSubject: ${this.forwardFrom.subject || '(No Subject)'}\n\n${originalBody}`;
    },
    handleClose() {
      if (this.sending) return;
      this.$emit('close');
    },
    handleEscapeKey(event) {
      if (event.key === 'Escape' && !this.sending) {
        this.handleClose();
      }
    },
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleString('en-US', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      });
    },
    async handleSend() {
      if (!this.to || this.sending) return;

      this.sending = true;
      this.error = null;

      try {
        await sendEmail({
          to: this.to,
          subject: this.subject,
          body: this.body
        });
        this.$emit('sent');
        this.$emit('close');
      } catch (e) {
        this.error = e.message || 'Failed to send email';
      } finally {
        this.sending = false;
      }
    },

    handleToInput() {
      // Debounce the search
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

      const query = this.to.trim();
      if (query.length < 1) {
        this.suggestions = [];
        this.showSuggestions = false;
        return;
      }

      this.searchTimeout = setTimeout(async () => {
        try {
          const results = await searchContacts(query, 8);
          this.suggestions = results;
          this.showSuggestions = results.length > 0;
          this.selectedSuggestionIndex = -1;
        } catch (e) {
          console.error('Failed to search contacts:', e);
          this.suggestions = [];
        }
      }, 150);
    },

    handleToKeydown(event) {
      if (!this.showSuggestions || this.suggestions.length === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.selectedSuggestionIndex = Math.min(
            this.selectedSuggestionIndex + 1,
            this.suggestions.length - 1
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, -1);
          break;
        case 'Enter':
          if (this.selectedSuggestionIndex >= 0) {
            event.preventDefault();
            this.selectSuggestion(this.suggestions[this.selectedSuggestionIndex]);
          }
          break;
        case 'Escape':
          this.showSuggestions = false;
          this.selectedSuggestionIndex = -1;
          break;
      }
    },

    handleToBlur() {
      // Delay hiding to allow click on suggestion
      setTimeout(() => {
        this.showSuggestions = false;
        this.selectedSuggestionIndex = -1;
      }, 150);
    },

    handleToFocus() {
      if (this.suggestions.length > 0 && this.to.trim().length > 0) {
        this.showSuggestions = true;
      }
    },

    selectSuggestion(contact) {
      this.to = contact.email;
      this.showSuggestions = false;
      this.suggestions = [];
      this.selectedSuggestionIndex = -1;
      // Move focus to subject field
      this.$nextTick(() => {
        this.$refs.subjectInput?.focus();
      });
    }
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  pointer-events: none;
}

.compose-modal {
  position: fixed;
  bottom: 0;
  right: 24px;
  width: 500px;
  height: 500px;
  background: var(--color-bg, #fff);
  border-radius: 8px 8px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.compose-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.compose-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text, #202020);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--color-text-secondary, #808080);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-text, #202020);
}

.compose-form {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.form-field {
  display: flex;
  flex-direction: column;
  padding: 0 20px;
}

.form-field:first-child {
  padding-top: 16px;
}

.form-field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #808080);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-field input,
.form-field textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text, #202020);
  background: var(--color-bg, #fff);
  margin-bottom: 12px;
}

.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: var(--color-primary, #db4c3f);
}

.form-field input:disabled,
.form-field textarea:disabled {
  background: var(--color-bg-secondary, #f9f9f9);
  cursor: not-allowed;
}

.to-field {
  position: relative;
}

.autocomplete-wrapper {
  position: relative;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-bg, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-top: none;
  border-radius: 0 0 4px 4px;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.suggestions-dropdown li {
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text, #202020);
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}

.suggestions-dropdown li:last-child {
  border-bottom: none;
}

.suggestions-dropdown li:hover,
.suggestions-dropdown li.active {
  background: var(--color-bg-secondary, #f5f5f5);
}

.suggestions-dropdown li.active {
  background: var(--color-primary-light, #fef2f2);
}

.body-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.body-field textarea {
  flex: 1;
  min-height: 0;
  resize: none;
}

.error-message {
  padding: 10px 20px;
  color: var(--color-primary, #db4c3f);
  font-size: 14px;
}

.compose-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border, #e0e0e0);
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn-primary {
  background: var(--color-primary, #db4c3f);
  color: #fff;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #c53727);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg, #fff);
  color: var(--color-text, #202020);
  border: 1px solid var(--color-border, #e0e0e0);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-secondary, #f9f9f9);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .compose-modal {
    left: 0;
    right: 0;
    width: 100%;
    height: 70%;
    border-radius: 12px 12px 0 0;
  }
}
</style>
