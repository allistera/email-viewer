<template>
  <div v-if="show" class="modal-overlay" :class="{ 'modal-overlay--fullscreen': isFullscreen }">
    <div
      class="compose-modal"
      :class="{ 'compose-modal--minimized': isMinimized, 'compose-modal--fullscreen': isFullscreen }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-title"
    >
      <div class="compose-header" @dblclick="toggleMinimize">
        <h2 id="compose-title">{{ replyTo ? 'Reply' : forwardFrom ? 'Forward' : (subject.trim() || 'New Message') }}</h2>
        <span v-if="hasDraft && !replyTo && !forwardFrom" class="draft-indicator" title="Draft saved">Draft saved</span>
        <div class="compose-header-actions">
          <button class="header-btn" @click.stop="toggleMinimize" :title="isMinimized ? 'Restore' : 'Minimize'" :aria-label="isMinimized ? 'Restore' : 'Minimize'">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="5" y1="19" x2="19" y2="19"/>
            </svg>
          </button>
          <button class="header-btn" @click.stop="toggleFullscreen" :title="isFullscreen ? 'Exit full screen' : 'Full screen'" :aria-label="isFullscreen ? 'Exit full screen' : 'Full screen'">
            <svg v-if="!isFullscreen" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 14 10 14 10 20"/>
              <polyline points="20 10 14 10 14 4"/>
              <line x1="10" y1="14" x2="3" y2="21"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
            </svg>
          </button>
          <button class="close-btn" @click="handleClose" title="Close" aria-label="Close">&times;</button>
        </div>
      </div>

      <form @submit.prevent="handleSend" class="compose-form">
        <div class="form-field to-field">
          <div class="to-field-row">
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
                    :aria-label="'Remove ' + recipient"
                  >
                    &times;
                  </button>
                </span>
                <input
                  id="compose-to"
                  ref="toInput"
                  v-model="toInput"
                  type="text"
                  placeholder="To"
                  :disabled="sending"
                  autocomplete="off"
                  @input="handleToInput"
                  @keydown="handleToKeydown"
                  @focus="handleToFocus"
                  @blur="handleToBlur"
                  role="combobox"
                  aria-autocomplete="list"
                  :aria-expanded="showSuggestions && suggestions.length > 0"
                  aria-controls="suggestions-listbox"
                  :aria-activedescendant="selectedSuggestionIndex >= 0 ? `suggestion-${selectedSuggestionIndex}` : null"
                />
              </div>
              <ul
                v-if="showSuggestions && suggestions.length > 0"
                class="suggestions-dropdown"
                id="suggestions-listbox"
                role="listbox"
              >
                <li
                  v-for="(suggestion, index) in suggestions"
                  :key="suggestion.email"
                  :id="`suggestion-${index}`"
                  role="option"
                  :aria-selected="index === selectedSuggestionIndex"
                  :class="{ selected: index === selectedSuggestionIndex }"
                  @mousedown.prevent="selectSuggestion(suggestion)"
                  @mouseenter="selectedSuggestionIndex = index"
                >
                  {{ suggestion.email }}
                </li>
              </ul>
            </div>
            <div class="cc-bcc-toggles">
              <button v-if="!showCc" type="button" class="cc-bcc-btn" @click.prevent="toggleCc">Cc</button>
              <button v-if="!showBcc" type="button" class="cc-bcc-btn" @click.prevent="toggleBcc">Bcc</button>
            </div>
          </div>
        </div>

        <!-- Cc field -->
        <div v-show="showCc" class="form-field cc-field">
          <div class="to-input-container" @click="focusCcInput">
            <span class="field-label">Cc</span>
            <span v-for="(r, i) in ccRecipients" :key="`cc-${r}-${i}`" class="to-pill">
              <span class="to-pill-text">{{ r }}</span>
              <button type="button" class="to-pill-remove" :disabled="sending" @click.stop="removeCcRecipient(i)">&times;</button>
            </span>
            <input ref="ccInput" v-model="ccInputValue" type="text" :disabled="sending" autocomplete="off" @keydown="handleCcKeydown" />
          </div>
        </div>

        <!-- Bcc field -->
        <div v-show="showBcc" class="form-field bcc-field">
          <div class="to-input-container" @click="focusBccInput">
            <span class="field-label">Bcc</span>
            <span v-for="(r, i) in bccRecipients" :key="`bcc-${r}-${i}`" class="to-pill">
              <span class="to-pill-text">{{ r }}</span>
              <button type="button" class="to-pill-remove" :disabled="sending" @click.stop="removeBccRecipient(i)">&times;</button>
            </span>
            <input ref="bccInput" v-model="bccInputValue" type="text" :disabled="sending" autocomplete="off" @keydown="handleBccKeydown" />
          </div>
        </div>

        <div class="form-field subject-field">
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
          <div
            ref="bodyInput"
            class="body-editor"
            :class="{ 'body-editor--disabled': sending }"
            contenteditable="true"
            @input="onBodyInput"
            @keydown="handleBodyKeydown"
            aria-label="Message body"
          ></div>
        </div>

        <div v-if="attachments.length > 0" class="form-field attachments-field">
          <div class="attachments-row">
            <div class="attachment-chips">
              <div
                v-for="(file, index) in attachments"
                :key="`${file.name}-${file.size}-${index}`"
                class="attachment-chip"
              >
                <span class="attachment-chip-name" :title="file.name">{{ file.name }}</span>
                <span class="attachment-chip-size">{{ formatFileSize(file.size) }}</span>
                <button
                  type="button"
                  class="attachment-chip-remove"
                  :disabled="sending"
                  @click="removeAttachment(index)"
                  :aria-label="'Remove ' + file.name"
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
        </div>

        <input
          ref="fileInput"
          type="file"
          class="file-input-hidden"
          multiple
          accept="*/*"
          @change="handleFileSelect"
          aria-label="Attach files"
        />

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="aiBarOpen" class="ai-compose-bar" :class="{ 'ai-busy': aiLoading }">
          <span class="ai-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 4V2"/>
              <path d="M15 16v-2"/>
              <path d="M8 9h2"/>
              <path d="M20 9h2"/>
              <path d="M17.8 11.8 19 13"/>
              <path d="M15 9h.01"/>
              <path d="M17.8 6.2 19 5"/>
              <path d="m3 21 9-9"/>
              <path d="M12.2 6.2 11 5"/>
            </svg>
          </span>
          <input
            ref="aiPromptInput"
            v-model="aiPrompt"
            type="text"
            class="ai-prompt-input"
            :placeholder="aiPlaceholder"
            :disabled="aiLoading || sending"
            @keydown.enter.prevent="handleAiCreate"
            @keydown.esc.prevent="closeAiBar"
            aria-label="AI compose prompt"
          />
          <button
            type="button"
            class="ai-cancel-btn"
            :disabled="aiLoading"
            @click="closeAiBar"
          >
            Cancel
          </button>
          <button
            type="button"
            class="ai-create-btn"
            :disabled="!aiPrompt.trim() || aiLoading || sending"
            @click="handleAiCreate"
          >
            <span v-if="aiLoading" class="ai-spinner" aria-hidden="true"></span>
            {{ aiLoading ? 'Creating…' : 'Create' }}
          </button>
        </div>

        <template v-else>
          <!-- Formatting toolbar – fullscreen always, or toggled in normal mode -->
          <div v-if="isFullscreen || showFormatBar" class="format-toolbar">
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('undo')" title="Undo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
            </button>
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('redo')" title="Redo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/></svg>
            </button>
            <div class="fmt-divider"></div>
            <button type="button" class="fmt-btn fmt-bold" @mousedown.prevent="execFormat('bold')" title="Bold"><b>B</b></button>
            <button type="button" class="fmt-btn fmt-italic" @mousedown.prevent="execFormat('italic')" title="Italic"><i>I</i></button>
            <button type="button" class="fmt-btn fmt-underline" @mousedown.prevent="execFormat('underline')" title="Underline"><u>U</u></button>
            <button type="button" class="fmt-btn fmt-strike" @mousedown.prevent="execFormat('strikeThrough')" title="Strikethrough"><s>S</s></button>
            <div class="fmt-divider"></div>
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('justifyLeft')" title="Align left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
            </button>
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('justifyCenter')" title="Align center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            </button>
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('justifyRight')" title="Align right">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div class="fmt-divider"></div>
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('insertOrderedList')" title="Numbered list">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
            </button>
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('insertUnorderedList')" title="Bullet list">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></svg>
            </button>
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('outdent')" title="Decrease indent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="21" y1="6" x2="11" y2="6"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="18" x2="11" y2="18"/><polyline points="7 8 3 12 7 16"/></svg>
            </button>
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('indent')" title="Increase indent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><polyline points="7 8 11 12 7 16"/></svg>
            </button>
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('formatBlock', 'blockquote')" title="Quote">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
            </button>
            <div class="fmt-divider"></div>
            <button type="button" class="fmt-btn" @mousedown.prevent="execFormat('removeFormat')" title="Remove formatting">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M5 20h6"/><path d="M13 4l-4 16"/><line x1="22" y1="2" x2="2" y2="22"/></svg>
            </button>
          </div>

          <div class="compose-actions">
          <div v-if="undoCountdown > 0" class="undo-send-bar">
            <span>Sending in {{ undoCountdown }}s…</span>
            <button type="button" class="btn-undo" @click="handleUndoSend">Undo</button>
          </div>
          <template v-else>
            <button
              type="submit"
              class="btn-send"
              :disabled="sending || !hasRecipients"
              :aria-busy="sending"
            >
              <span v-if="sending" class="spinner" aria-hidden="true"></span>
              {{ sending ? 'Sending...' : 'Send' }}
            </button>
            <button
              type="button"
              class="icon-btn"
              :disabled="sending"
              @click="triggerFileInput"
              title="Attach files"
              aria-label="Attach files"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <TemplatePicker :disabled="sending" @select="applyTemplate" />
            <button
              type="button"
              class="icon-btn"
              :class="{ 'icon-btn--active': showFormatBar && !isFullscreen }"
              :disabled="sending"
              @click="showFormatBar = !showFormatBar"
              title="Text formatting"
              aria-label="Text formatting"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn"
              :disabled="sending"
              @click="openAiBar"
              title="AI compose (or type / in body)"
              aria-label="AI compose"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 4V2"/>
                <path d="M15 16v-2"/>
                <path d="M8 9h2"/>
                <path d="M20 9h2"/>
                <path d="M17.8 11.8 19 13"/>
                <path d="M15 9h.01"/>
                <path d="M17.8 6.2 19 5"/>
                <path d="m3 21 9-9"/>
                <path d="M12.2 6.2 11 5"/>
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn icon-btn-trailing"
              :disabled="sending || !hasDraftableContent"
              @click="handleSaveDraft"
              title="Save as draft"
              aria-label="Save as draft"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn"
              :disabled="sending"
              @click="handleDiscard"
              title="Discard draft"
              aria-label="Discard draft"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/>
              </svg>
            </button>
          </template>
          </div><!-- end compose-actions -->
        </template><!-- end v-else (not aiBarOpen) -->
      </form>
    </div>
  </div>
</template>

<script>
import { sendEmail, getContactSuggestions, aiComposeMessage } from '../services/api.js';
import { saveDraft as persistDraft, deleteDraft } from '../services/drafts.js';
import { getEmailSignature } from '../services/signature.js';
import TemplatePicker from './TemplatePicker.vue';

export default {
  name: 'ComposeModal',
  components: { TemplatePicker },
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
    },
    draft: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'sent'],
  data() {
    return {
      recipients: [],
      toInput: '',
      showCc: false,
      showBcc: false,
      ccRecipients: [],
      bccRecipients: [],
      ccInputValue: '',
      bccInputValue: '',
      subject: '',
      body: '',
      attachments: [],
      sending: false,
      undoCountdown: 0,
      undoTimer: null,
      undoCancelled: false,
      error: null,
      suggestions: [],
      showSuggestions: false,
      selectedSuggestionIndex: -1,
      debounceTimer: null,
      autosaveTimer: null,
      hasDraft: false,
      draftId: null,
      aiPrompt: '',
      aiLoading: false,
      aiBarOpen: false,
      isMinimized: false,
      isFullscreen: false,
      showFormatBar: false
    };
  },
  computed: {
    aiPlaceholder() {
      return this.replyTo
        ? 'Ask AI to draft a reply…'
        : 'Ask AI to write a message…';
    },
    hasRecipients() {
      return this.recipients.length > 0 || this.toInput.trim().length > 0;
    },
    hasDraftableContent() {
      if (this.replyTo || this.forwardFrom) return false;
      return (
        this.recipients.length > 0 ||
        this.toInput.trim().length > 0 ||
        this.subject.trim().length > 0 ||
        this.body.trim().length > 0
      );
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.isMinimized = false;
        this.isFullscreen = false;
        this.resetForm();
        if (this.replyTo) {
          this.prefillReply();
          this.$nextTick(() => {
            const textarea = this.$refs.bodyInput;
            if (textarea) {
              textarea.focus();
              textarea.setSelectionRange(0, 0);
            }
          });
        } else if (this.forwardFrom) {
          this.prefillForward();
          this.$nextTick(() => {
            this.$refs.toInput?.focus();
          });
        } else if (this.draft) {
          this.prefillFromDraft();
          this.$nextTick(() => {
            this.$refs.toInput?.focus();
          });
        } else {
          this.applySignature();
          this.$nextTick(() => {
            this.$refs.toInput?.focus();
          });
        }
        document.addEventListener('keydown', this.handleEscapeKey);
      } else {
        document.removeEventListener('keydown', this.handleEscapeKey);
        this.cancelAutosave();
        this.flushDraft();
      }
    },
    subject() { this.scheduleDraftSave(); },
    body(newVal) {
      // Sync programmatic body changes to the contenteditable DOM
      const el = this.$refs.bodyInput;
      if (el && el.innerHTML !== newVal) {
        el.innerHTML = newVal;
      }
    },
    recipients() { this.scheduleDraftSave(); },
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscapeKey);
    this.cancelAutosave();
  },
  methods: {
    resetForm() {
      this.recipients = [];
      this.toInput = '';
      this.showCc = false;
      this.showBcc = false;
      this.ccRecipients = [];
      this.bccRecipients = [];
      this.ccInputValue = '';
      this.bccInputValue = '';
      this.subject = '';
      this.body = '';
      this.$nextTick(() => {
        if (this.$refs.bodyInput) this.$refs.bodyInput.innerHTML = '';
      });
      this.attachments = [];
      this.error = null;
      this.sending = false;
      this.undoCancelled = true;
      if (this.undoTimer) {
        clearInterval(this.undoTimer);
        this.undoTimer = null;
      }
      this.undoCountdown = 0;
      this.suggestions = [];
      this.showSuggestions = false;
      this.selectedSuggestionIndex = -1;
      this.hasDraft = false;
      this.draftId = null;
      this.aiPrompt = '';
      this.aiLoading = false;
      this.aiBarOpen = false;
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },

    scheduleDraftSave() {
      if (this.replyTo || this.forwardFrom) return;
      if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
      this.autosaveTimer = setTimeout(() => this.saveDraft(), 2000);
    },

    cancelAutosave() {
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = null;
      }
    },

    saveDraft() {
      if (this.replyTo || this.forwardFrom) return;
      const id = persistDraft({
        id: this.draftId,
        recipients: this.recipients,
        subject: this.subject,
        body: this.body
      });
      this.draftId = id;
      this.hasDraft = !!id;
    },

    flushDraft() {
      if (this.replyTo || this.forwardFrom) return;
      this.saveDraft();
    },

    prefillFromDraft() {
      const d = this.draft;
      if (!d) return;
      this.draftId = d.id || null;
      this.recipients = Array.isArray(d.recipients) ? [...d.recipients] : [];
      this.subject = d.subject || '';
      this.body = d.body || '';
      this.hasDraft = !!this.draftId;
    },

    applySignature() {
      try {
        const sigHtml = getEmailSignature();
        if (!sigHtml) return;
        if (!this.body.includes(sigHtml)) {
          this.body = `${this.body || ''}<div><br>--<br></div>${sigHtml}`;
        }
      } catch { /* ignore */ }
    },
    discardDraft() {
      if (this.draftId) {
        deleteDraft(this.draftId);
      }
      this.draftId = null;
      this.hasDraft = false;
    },
    triggerFileInput() {
      this.$refs.fileInput?.click();
    },
    handleFileSelect(event) {
      const input = event.target;
      if (!input?.files?.length) return;
      const files = Array.from(input.files);
      for (const file of files) {
        this.attachments.push(file);
      }
      input.value = '';
    },
    removeAttachment(index) {
      if (index >= 0 && index < this.attachments.length) {
        this.attachments.splice(index, 1);
      }
    },
    formatFileSize(bytes) {
      if (bytes === null || bytes === undefined || isNaN(bytes)) return '';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      if (pending) { this.addRecipient(pending); this.toInput = ''; }
      const pendingCc = this.ccInputValue.trim();
      if (pendingCc) { this.addCcRecipient(pendingCc); this.ccInputValue = ''; }
      const pendingBcc = this.bccInputValue.trim();
      if (pendingBcc) { this.addBccRecipient(pendingBcc); this.bccInputValue = ''; }
    },
    isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },

    // CC/BCC
    toggleCc() {
      this.showCc = true;
      this.$nextTick(() => this.$refs.ccInput?.focus());
    },
    toggleBcc() {
      this.showBcc = true;
      this.$nextTick(() => this.$refs.bccInput?.focus());
    },
    focusCcInput() { this.$refs.ccInput?.focus(); },
    focusBccInput() { this.$refs.bccInput?.focus(); },
    addCcRecipient(email) {
      const trimmed = String(email || '').trim();
      if (!trimmed) return;
      if (this.ccRecipients.some(e => e.toLowerCase() === trimmed.toLowerCase())) return;
      this.ccRecipients.push(trimmed);
    },
    removeCcRecipient(index) { this.ccRecipients.splice(index, 1); },
    handleCcKeydown(event) {
      if ((event.key === 'Enter' || event.key === ',') && this.ccInputValue.trim()) {
        event.preventDefault();
        this.addCcRecipient(this.ccInputValue.trim());
        this.ccInputValue = '';
      } else if (event.key === 'Backspace' && !this.ccInputValue && this.ccRecipients.length > 0) {
        this.removeCcRecipient(this.ccRecipients.length - 1);
      }
    },
    addBccRecipient(email) {
      const trimmed = String(email || '').trim();
      if (!trimmed) return;
      if (this.bccRecipients.some(e => e.toLowerCase() === trimmed.toLowerCase())) return;
      this.bccRecipients.push(trimmed);
    },
    removeBccRecipient(index) { this.bccRecipients.splice(index, 1); },
    handleBccKeydown(event) {
      if ((event.key === 'Enter' || event.key === ',') && this.bccInputValue.trim()) {
        event.preventDefault();
        this.addBccRecipient(this.bccInputValue.trim());
        this.bccInputValue = '';
      } else if (event.key === 'Backspace' && !this.bccInputValue && this.bccRecipients.length > 0) {
        this.removeBccRecipient(this.bccRecipients.length - 1);
      }
    },

    // HTML helpers
    escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    toHtml(text) {
      return this.escapeHtml(text).replace(/\n/g, '<br>');
    },
    getPlainText() {
      const el = this.$refs.bodyInput;
      if (el) return el.textContent || el.innerText || '';
      const tmp = document.createElement('div');
      tmp.innerHTML = this.body;
      return tmp.textContent || tmp.innerText || '';
    },

    // Contenteditable body sync
    onBodyInput() {
      this.body = this.$refs.bodyInput?.innerHTML || '';
      this.scheduleDraftSave();
    },

    // Rich text formatting
    execFormat(command, value = null) {
      this.$refs.bodyInput?.focus();
      document.execCommand(command, false, value);
    },

    prefillReply() {
      if (!this.replyTo) return;
      const rawFrom = (this.replyTo.from || '').trim();
      if (rawFrom) {
        const fromMatch = rawFrom.match(/<([^>]+)>/);
        const email = (fromMatch && fromMatch[1] ? fromMatch[1] : rawFrom).trim();
        this.recipients = email ? [email] : [];
      } else {
        this.recipients = [];
      }
      this.toInput = '';
      const subj = this.replyTo.subject || '';
      this.subject = subj.startsWith('Re:') ? subj : `Re: ${subj}`;
      const date = this.formatDate(this.replyTo.receivedAt);
      const from = this.escapeHtml(this.replyTo.from);
      const originalHtml = this.replyTo.htmlBody
        ? this.replyTo.htmlBody
        : `<pre style="font-family:inherit;white-space:pre-wrap;margin:0;">${this.escapeHtml(this.replyTo.textBody || '')}</pre>`;
      this.body = `<div><br></div><div><br></div><div style="color:#5f6368;font-size:13px;">On ${date}, ${from} wrote:</div><blockquote style="margin:4px 0 0 0;padding-left:12px;border-left:3px solid #ccc;">${originalHtml}</blockquote>`;
    },
    prefillForward() {
      if (!this.forwardFrom) return;
      this.recipients = [];
      this.toInput = '';
      const subj = this.forwardFrom.subject || '';
      this.subject = subj.startsWith('Fwd:') ? subj : `Fwd: ${subj}`;
      const date = this.formatDate(this.forwardFrom.receivedAt);
      const originalHtml = this.forwardFrom.htmlBody
        ? this.forwardFrom.htmlBody
        : `<pre style="font-family:inherit;white-space:pre-wrap;margin:0;">${this.escapeHtml(this.forwardFrom.textBody || '')}</pre>`;
      this.body = `<div><br></div><div style="border-top:1px solid #e0e0e0;padding-top:12px;margin-top:12px;font-size:13px;color:#5f6368;"><b>---------- Forwarded message ----------</b><br>From: ${this.escapeHtml(this.forwardFrom.from)}<br>Date: ${date}<br>Subject: ${this.escapeHtml(this.forwardFrom.subject || '(No Subject)')}</div><div style="margin-top:12px;">${originalHtml}</div>`;
    },
    toggleMinimize() {
      this.isMinimized = !this.isMinimized;
      if (this.isMinimized) this.isFullscreen = false;
    },
    toggleFullscreen() {
      this.isFullscreen = !this.isFullscreen;
      if (this.isFullscreen) this.isMinimized = false;
    },
    handleClose() {
      if (this.sending) return;
      this.isMinimized = false;
      this.isFullscreen = false;
      this.showFormatBar = false;
      this.$emit('close');
    },
    handleDiscard() {
      if (this.sending) return;
      this.cancelAutosave();
      this.discardDraft();
      this.$emit('close');
    },
    applyTemplate(tpl) {
      if (!tpl) return;
      if (!this.subject && tpl.subject) {
        this.subject = tpl.subject;
      }
      if (tpl.body) {
        const currentText = this.getPlainText().trim();
        if (currentText.length > 0) {
          this.body = `${this.toHtml(tpl.body)}<br>${this.$refs.bodyInput?.innerHTML || ''}`;
        } else {
          this.body = this.toHtml(tpl.body);
        }
      }
      this.$nextTick(() => this.$refs.bodyInput?.focus());
    },
    handleSaveDraft() {
      if (this.sending || this.replyTo || this.forwardFrom) return;
      this.finalizeRecipients();
      this.cancelAutosave();
      this.saveDraft();
      this.$emit('close');
    },
    handleEscapeKey(event) {
      if (event.key === 'Escape' && !this.sending) {
        this.isMinimized = true;
        this.isFullscreen = false;
      }
    },
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleString('en-US', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      });
    },
    async handleSend() {
      if (this.sending || this.undoCountdown > 0) return;
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

      const UNDO_SECONDS = 5;
      this.undoCancelled = false;
      this.undoCountdown = UNDO_SECONDS;

      await new Promise((resolve) => {
        let remaining = UNDO_SECONDS;
        this.undoTimer = setInterval(() => {
          remaining -= 1;
          this.undoCountdown = remaining;
          if (remaining <= 0 || this.undoCancelled) {
            clearInterval(this.undoTimer);
            this.undoTimer = null;
            this.undoCountdown = 0;
            resolve();
          }
        }, 1000);
      });

      if (this.undoCancelled) return;

      this.sending = true;
      try {
        await sendEmail({
          to: this.recipients,
          cc: this.ccRecipients.length > 0 ? this.ccRecipients : undefined,
          bcc: this.bccRecipients.length > 0 ? this.bccRecipients : undefined,
          subject: this.subject,
          body: this.getPlainText(),
          htmlBody: this.body,
          replyToId: this.replyTo?.id,
          attachments: this.attachments.length > 0 ? this.attachments : undefined
        });
        this.discardDraft();
        this.$emit('sent');
        this.$emit('close');
      } catch (e) {
        this.error = e.message || 'Failed to send email';
      } finally {
        this.sending = false;
      }
    },

    handleBodyKeydown(event) {
      if (event.key === '/' && !this.aiBarOpen && !this.aiLoading && !this.sending) {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed) {
          event.preventDefault();
          this.openAiBar();
        }
      }
    },

    openAiBar() {
      this.aiBarOpen = true;
      this.$nextTick(() => {
        this.$refs.aiPromptInput?.focus();
      });
    },

    closeAiBar() {
      this.aiBarOpen = false;
      this.aiPrompt = '';
    },

    async handleAiCreate() {
      const prompt = this.aiPrompt.trim();
      if (!prompt || this.aiLoading || this.sending) return;

      this.aiLoading = true;
      this.error = null;

      const mode = this.replyTo ? 'reply' : 'compose';
      const context = this.replyTo
        ? {
            from: this.replyTo.from || '',
            subject: this.replyTo.subject || '',
            body: this.replyTo.textBody || ''
          }
        : null;
      let senderName = '';
      try {
        senderName = (localStorage.getItem('userFullName') || '').trim();
      } catch { /* ignore */ }

      try {
        const result = await aiComposeMessage({ prompt, mode, context, senderName });
        if (result?.subject && !this.replyTo && !this.forwardFrom) {
          this.subject = result.subject;
        } else if (result?.subject && !this.subject) {
          this.subject = result.subject;
        }
        if (result?.body) {
          const resultHtml = this.toHtml(result.body);
          if (this.replyTo) {
            const currentHtml = this.$refs.bodyInput?.innerHTML || '';
            this.body = `${resultHtml}<br>${currentHtml}`;
          } else {
            this.body = resultHtml;
          }
        }
        this.aiPrompt = '';
        this.aiBarOpen = false;
      } catch (e) {
        this.error = e?.message || 'Failed to generate message';
      } finally {
        this.aiLoading = false;
      }
    },

    handleUndoSend() {
      this.undoCancelled = true;
      if (this.undoTimer) {
        clearInterval(this.undoTimer);
        this.undoTimer = null;
      }
      this.undoCountdown = 0;
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

.modal-overlay--fullscreen {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.compose-modal {
  position: fixed;
  bottom: 0;
  right: 24px;
  width: 540px;
  height: 560px;
  background: var(--color-bg, #fff);
  border-radius: 12px 12px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  pointer-events: auto;
  animation: slideUp 0.2s ease-out;
  overflow: hidden;
}

.compose-modal--minimized {
  height: auto;
}

.compose-modal--minimized .compose-form {
  display: none;
}

.compose-modal--fullscreen {
  position: static;
  width: min(860px, 90vw);
  height: min(88vh, 800px);
  border-radius: 12px;
  animation: none;
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
  padding: 10px 12px 10px 16px;
  background: var(--color-bg-secondary, #f2f6fc);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  cursor: default;
  flex-shrink: 0;
}

.compose-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text, #202020);
}

.draft-indicator {
  font-size: 12px;
  color: var(--color-text-secondary, #808080);
  margin-left: auto;
  margin-right: 8px;
}

.compose-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.header-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary, #808080);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.header-btn:hover {
  background: var(--color-bg-hover, #e3e5e8);
  color: var(--color-text, #202020);
}

.close-btn {
  background: none;
  border: none;
  font-size: 22px;
  color: var(--color-text-secondary, #808080);
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--color-bg-hover, #e3e5e8);
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
  padding: 0 16px;
}

.to-field {
  padding-top: 4px;
  position: relative;
}

.to-field-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.to-input-wrapper {
  flex: 1;
  min-width: 0;
  position: relative;
}

.cc-bcc-toggles {
  display: flex;
  gap: 4px;
  padding-top: 10px;
  flex-shrink: 0;
}

.cc-bcc-btn {
  background: none;
  border: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #808080);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  line-height: 1.4;
}

.cc-bcc-btn:hover {
  color: var(--color-text, #202020);
  background: var(--color-bg-secondary, #f5f5f5);
}

.cc-field,
.bcc-field {
  padding-top: 0;
}

.field-label {
  font-size: 13px;
  color: var(--color-text-secondary, #808080);
  padding: 0 8px 0 0;
  flex-shrink: 0;
  align-self: center;
  pointer-events: none;
}

.form-field input,
.form-field textarea {
  padding: 10px 0;
  border: none;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  border-radius: 0;
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text, #202020);
  background: transparent;
}

.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-bottom-color: var(--color-border, #e0e0e0);
}

.to-input-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 4px 0;
  border: none;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  background: transparent;
}

.to-input-container:focus-within {
  border-bottom-color: var(--color-border, #e0e0e0);
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
  padding-top: 8px;
}

.body-editor {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0 8px;
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text, #202020);
  line-height: 1.6;
  outline: none;
  word-break: break-word;
}

.body-editor:empty::before {
  content: 'Write your message…';
  color: var(--color-text-secondary, #b0b8c1);
  opacity: 0.6;
  pointer-events: none;
}

.body-editor--disabled {
  opacity: 0.7;
  pointer-events: none;
}

.body-editor blockquote {
  margin: 4px 0 0 0;
  padding-left: 12px;
  border-left: 3px solid #ccc;
  color: var(--color-text-secondary, #5f6368);
}

.attachments-field {
  padding-top: 0;
  padding-bottom: 12px;
}

.attachments-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.file-input-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  overflow: hidden;
}

.attachment-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 10px;
  background: var(--color-bg-secondary, #f5f5f5);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 16px;
  font-size: 12px;
  color: var(--color-text, #202020);
  max-width: 180px;
}

.attachment-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-chip-size {
  color: var(--color-text-secondary, #808080);
  flex-shrink: 0;
}

.attachment-chip-remove {
  background: none;
  border: none;
  color: var(--color-text-secondary, #808080);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  font-size: 16px;
  flex-shrink: 0;
}

.attachment-chip-remove:hover:not(:disabled) {
  color: var(--color-primary, #db4c3f);
}

.attachment-chip-remove:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.error-message {
  padding: 10px 20px;
  color: var(--color-primary, #db4c3f);
  font-size: 14px;
}

.format-toolbar {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 6px 12px;
  border-top: 1px solid var(--color-border, #e0e0e0);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.fmt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text-secondary, #5f6368);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  padding: 0;
  transition: background 0.12s, color 0.12s;
  flex-shrink: 0;
}

.fmt-btn:hover {
  background: var(--color-bg-secondary, #f1f3f4);
  color: var(--color-text, #202020);
}

.fmt-bold { font-weight: 700; }
.fmt-italic { font-style: italic; }
.fmt-underline { text-decoration: underline; }
.fmt-strike { text-decoration: line-through; }

.fmt-divider {
  width: 1px;
  height: 18px;
  background: var(--color-border, #e0e0e0);
  margin: 0 4px;
  flex-shrink: 0;
}

.compose-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-top: 1px solid var(--color-border, #e0e0e0);
}

.btn-send {
  padding: 8px 24px;
  border-radius: 9999px;
  background: #1a73e8;
  color: #fff;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s, opacity 0.15s;
  margin-right: 8px;
}

.btn-send:hover:not(:disabled) {
  background: #1765cc;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.btn-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--color-text-secondary, #5f6368);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.icon-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary, #f1f3f4);
  color: var(--color-text, #202020);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-btn--active {
  color: var(--color-primary, #1a73e8);
  background: var(--color-bg-secondary, #f1f3f4);
}

.icon-btn-trailing {
  margin-left: auto;
}

.ai-compose-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 16px;
  padding: 6px 6px 6px 14px;
  background: var(--color-bg-secondary, #f3f3f5);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 9999px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ai-compose-bar:focus-within {
  border-color: var(--color-primary, #db4c3f);
  box-shadow: 0 0 0 3px rgba(219, 76, 63, 0.12);
}

.ai-compose-bar.ai-busy {
  opacity: 0.85;
}

.ai-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary, #808080);
  flex-shrink: 0;
}

.ai-prompt-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text, #202020);
  padding: 8px 4px;
  outline: none;
}

.ai-prompt-input::placeholder {
  color: var(--color-text-secondary, #808080);
}

.ai-prompt-input:disabled {
  cursor: not-allowed;
}

.ai-cancel-btn {
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-text-secondary, #808080);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 9999px;
}

.ai-cancel-btn:hover:not(:disabled) {
  color: var(--color-text, #202020);
}

.ai-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 9999px;
  background: var(--color-bg, #fff);
  color: var(--color-text, #202020);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}

.ai-create-btn:hover:not(:disabled) {
  background: var(--color-primary, #db4c3f);
  color: #fff;
}

.ai-create-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ai-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  border-top-color: currentColor;
  animation: spin 1s ease-in-out infinite;
}

.undo-send-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  justify-content: space-between;
  font-size: 14px;
  color: var(--color-text-secondary, #808080);
}

.btn-undo {
  padding: 6px 14px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 4px;
  background: var(--color-bg, #fff);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-primary, #e53e3e);
  transition: background 0.15s;
}

.btn-undo:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
