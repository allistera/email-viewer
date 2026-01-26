<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Create New Tag</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>Tag Name</label>
          <input
            v-model.trim="tagName"
            type="text"
            placeholder="e.g. Finance"
            class="input"
            @keyup.enter="handleCreate"
            ref="input"
          />
          <p class="hint">GPT will automatically categorize emails with this tag.</p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">
          Cancel
        </button>
        <button class="btn-primary" @click="handleCreate" :disabled="!tagName">
          Create Tag
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TagModal',
  emits: ['close', 'create'],
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      tagName: ''
    };
  },
  watch: {
    show(val) {
      if (val) {
        this.tagName = '';
        this.$nextTick(() => {
          this.$refs.input?.focus();
        });
      }
    }
  },
  methods: {
    handleCreate() {
      if (!this.tagName) return;
      this.$emit('create', this.tagName);
    }
  }
};
</script>

<style scoped>
/* Reuse styles from FilterModal or similar */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-bg);
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--color-text);
}

.close-btn {
  border: none;
  background: none;
  font-size: 28px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.modal-body {
  padding: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input {
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
}

.hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-secondary, .btn-primary {
  padding: 10px 20px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text);
}
</style>
