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
          <div class="to-input-wrapper">
            <div class="to-input-container" @click="focusToInput">
              <span
                v-for="(recipient, index) in recipients"
                :key="`${recipient}-${index}`"
                class="to-pill"
              >
                <span class="to-pill-text">{{ recipient }}</span>
                <button
                  type="button"
                  class="to-pill-remove"
                  :disabled="sending"
                  @click.stop="removeRecipient(index)"
                >
                  &times;
                </button>
              </span>
              <input
                id="compose-to"
                ref="toInput"
                v-model="toInput"
                type="text"
                placeholder="recipient@example.com"
                :disabled="sending"
                autocomplete="off"
                @input="handleToInput"
                @keydown="handleToKeydown"
                @focus="handleToFocus"
                @blur="handleToBlur"
              />
            </div>
            <ul v-if="showSuggestions && suggestions.length > 0" class="suggestions-dropdown">
              <li
                v-for="(suggestion, index) in suggestions"
                :key="suggestion.email"
                :class="{ selected: index === selectedSuggestionIndex }"
                @mousedown.prevent="selectSuggestion(suggestion)"
                @mouseenter="selectedSuggestionIndex = index"
              >
                {{ suggestion.email }}
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
          <button type="submit" class="btn-primary" :disabled="sending || !hasRecipients">
            {{ sending ? 'Sending...' : 'Send' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { sendEmail, getContactSuggestions } from '../services/api.js';

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
  computed: {
    hasRecipients() {
      return this.recipients.length > 0 || this.toInput.trim().length > 0;
    }
  },
  data() {
    return {
      recipients: [],
      toInput: '',
      subject: '',
      body: '',
      sending: false,
      error: null,
      suggestions: [],
      showSuggestions: false,
      selectedSuggestionIndex: -1,
      debounceTimer: null
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
      this.recipients = [];
      this.toInput = '';
      this.subject = '';
      this.body = '';
      this.error = null;
      this.sending = false;
      this.suggestions = [];
      this.showSuggestions = false;
      this.selectedSuggestionIndex = -1;
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    },
    async fetchSuggestions(query) {
      if (!query || query.length < 1) {
        this.suggestions = [];
        this.showSuggestions = false;
        return;
      }
      try {
        this.suggestions = await getContactSuggestions(query, 8);
        this.showSuggestions = this.suggestions.length > 0;
        this.selectedSuggestionIndex = -1;
      } catch (e) {
        console.error('Failed to fetch contact suggestions:', e);
        this.suggestions = [];
        this.showSuggestions = false;
      }
    },
    handleToInput() {
      this.updateRecipientsFromInput(this.toInput);
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.fetchSuggestions(this.toInput.trim());
      }, 150);
    },
    handleToFocus() {
      if (this.toInput && this.suggestions.length > 0) {
        this.showSuggestions = true;
      } else if (this.toInput) {
        this.fetchSuggestions(this.toInput.trim());
      }
    },
    handleToBlur() {
      // Delay hiding to allow click on suggestion
      if (this.blurTimer) {
        clearTimeout(this.blurTimer);
      }
      this.blurTimer = setTimeout(() => {
        this.showSuggestions = false;
        this.blurTimer = null;
      }, 200);
    },
    handleToKeydown(event) {
      if (this.showSuggestions && this.suggestions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          this.selectedSuggestionIndex = Math.min(
            this.selectedSuggestionIndex + 1,
            this.suggestions.length - 1
          );
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, -1);
          return;
        }
        if (event.key === 'Enter' && this.selectedSuggestionIndex >= 0) {
          event.preventDefault();
          this.selectSuggestion(this.suggestions[this.selectedSuggestionIndex]);
          return;
        }
        if (event.key === 'Escape') {
          this.showSuggestions = false;
          this.selectedSuggestionIndex = -1;
          return;
        }
      }

      if (event.key === 'Enter' && this.toInput.trim()) {
        event.preventDefault();
        this.addRecipient(this.toInput.trim());
        this.toInput = '';
        this.showSuggestions = false;
        this.selectedSuggestionIndex = -1;
        return;
      }

      if (event.key === 'Backspace' && !this.toInput && this.recipients.length > 0) {
        this.removeRecipient(this.recipients.length - 1);
      }
    },
    selectSuggestion(suggestion) {
      this.addRecipient(suggestion.email);
      this.toInput = '';
      this.showSuggestions = false;
      this.selectedSuggestionIndex = -1;
    },
    focusToInput() {
      this.$refs.toInput?.focus();
    },
    updateRecipientsFromInput(value) {
      const parts = value.split(',');
      if (parts.length === 1) {
        return;
      }
      const lastPart = parts.pop();
      const newRecipients = parts.map(part => part.trim()).filter(Boolean);
      newRecipients.forEach(email => this.addRecipient(email));
      this.toInput = (lastPart || '').replace(/^\s+/, '');
      if (newRecipients.length > 0) {
        this.showSuggestions = false;
        this.selectedSuggestionIndex = -1;
      }
    },
    addRecipient(email) {
      const trimmed = String(email || '').trim();
      if (!trimmed) return;
      const normalized = trimmed.toLowerCase();
      if (this.recipients.some(existing => existing.toLowerCase() === normalized)) {
        return;
      }
      this.recipients.push(trimmed);
    },
    removeRecipient(index) {
      if (index < 0 || index >= this.recipients.length) return;
      this.recipients.splice(index, 1);
    },
    finalizeRecipients() {
      const pending = this.toInput.trim();
      if (pending) {
        this.addRecipient(pending);
        this.toInput = '';
      }
    },
    isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
    prefillReply() {
      if (!this.replyTo) return;
      
      // Extract email from "Name <email>" format with robust handling
      const rawFrom = (this.replyTo.from || '').trim();
      if (rawFrom) {
        const fromMatch = rawFrom.match(/<([^>]+)>/);
        const email = (fromMatch && fromMatch[1] ? fromMatch[1] : rawFrom).trim();
        this.recipients = email ? [email] : [];
      } else {
        this.recipients = [];
      }
      this.toInput = '';
      
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
      this.recipients = [];
      this.toInput = '';
      
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
      if (this.sending) return;
      this.error = null;
      this.finalizeRecipients();
      if (this.recipients.length === 0) {
        this.error = 'Recipient (to) is required';
        return;
      }
      const invalidRecipients = this.recipients.filter(email => !this.isValidEmail(email));
      if (invalidRecipients.length > 0) {
        const label = invalidRecipients.length === 1 ? 'Invalid email address' : 'Invalid email addresses';
        this.error = `${label}: ${invalidRecipients.join(', ')}`;
        return;
      }

      this.sending = true;

      try {
        await sendEmail({
          to: this.recipients,
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

.to-input-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 6px 8px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 4px;
  background: var(--color-bg, #fff);
  margin-bottom: 12px;
}

.to-input-container:focus-within {
  border-color: var(--color-primary, #db4c3f);
}

.to-input-container input {
  border: none;
  padding: 6px 4px;
  margin: 0;
  flex: 1;
  min-width: 140px;
  font-size: 14px;
  background: transparent;
}

.to-input-container input:focus {
  outline: none;
  border: none;
}

.to-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--color-bg-secondary, #f5f5f5);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 16px;
  font-size: 12px;
  color: var(--color-text, #202020);
}

.to-pill-remove {
  background: none;
  border: none;
  color: var(--color-text-secondary, #808080);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  font-size: 14px;
}

.to-pill-remove:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.form-field input:disabled,
.form-field textarea:disabled {
  background: var(--color-bg-secondary, #f9f9f9);
  cursor: not-allowed;
}

.to-field {
  position: relative;
}

.to-input-wrapper {
  position: relative;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--color-bg, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-top: none;
  border-radius: 0 0 4px 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
}

.suggestions-dropdown li {
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text, #202020);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.suggestions-dropdown li:last-child {
  border-bottom: none;
}

.suggestions-dropdown li:hover,
.suggestions-dropdown li.selected {
  background: var(--color-bg-secondary, #f5f5f5);
}

.suggestions-dropdown li.selected {
  background: var(--color-bg-hover, #e8e8e8);
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
