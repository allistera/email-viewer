<template>
  <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Create Filter</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>Filter Name</label>
          <input
            v-model="filterName"
            type="text"
            placeholder="e.g., Work Emails"
            class="input"
            @keyup.enter="handleCreate"
          />
        </div>

        <div class="form-group">
          <label>Filter Type</label>
          <select v-model="filterType" class="select">
            <option value="sender">From (Sender)</option>
            <option value="subject">Subject Contains</option>
            <option value="spam">Spam Status</option>
          </select>
        </div>

        <div v-if="filterType === 'sender'" class="form-group">
          <label>Sender Email or Domain</label>
          <input
            v-model="filterValue"
            type="text"
            placeholder="e.g., alice@example.com or @company.com"
            class="input"
            @keyup.enter="handleCreate"
          />
        </div>

        <div v-else-if="filterType === 'subject'" class="form-group">
          <label>Subject Keywords</label>
          <input
            v-model="filterValue"
            type="text"
            placeholder="e.g., invoice, meeting"
            class="input"
            @keyup.enter="handleCreate"
          />
        </div>

        <div v-else-if="filterType === 'spam'" class="form-group">
          <label>Spam Status</label>
          <select v-model="filterValue" class="select">
            <option value="ham">Safe Only</option>
            <option value="spam">Spam Only</option>
            <option value="unknown">Unknown Only</option>
          </select>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">
          Cancel
        </button>
        <button class="btn-primary" @click="handleCreate" :disabled="!isValid">
          Create Filter
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FilterModal',
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      filterName: '',
      filterType: 'sender',
      filterValue: ''
    };
  },
  computed: {
    isValid() {
      return this.filterName.trim() && this.filterValue.trim();
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.resetForm();
      }
    }
  },
  methods: {
    resetForm() {
      this.filterName = '';
      this.filterType = 'sender';
      this.filterValue = '';
    },

    handleOverlayClick() {
      this.$emit('close');
    },

    handleCreate() {
      if (!this.isValid) return;

      this.$emit('create', {
        id: `filter_${Date.now()}`,
        name: this.filterName.trim(),
        type: this.filterType,
        value: this.filterValue.trim()
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
  max-width: 500px;
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
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text);
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.input,
.select {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
  transition: border-color 0.15s;
}

.input:focus,
.select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.select {
  cursor: pointer;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: var(--color-border);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
