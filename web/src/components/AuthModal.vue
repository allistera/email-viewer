<template>
  <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal" @click.stop>
      <h2>Authentication Required</h2>
      <p>Enter your API token to access the email inbox</p>

      <form @submit.prevent.stop="handleSubmit">
        <input
          v-model.trim="token"
          type="password"
          placeholder="API Token"
          class="token-input"
          autofocus
        />

        <div class="button-group">
          <button type="submit" class="btn btn-primary" :disabled="!token">
            Continue
          </button>
        </div>
      </form>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AuthModal',
  emits: ['submit'],
  props: {
    show: {
      type: Boolean,
      required: true
    },
    errorMessage: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      token: ''
    };
  },
  watch: {
    show(value) {
      if (value) {
        this.token = '';
      }
    }
  },
  methods: {
    handleSubmit() {
      if (!this.token) return;
      this.$emit('submit', this.token);
    },
    handleOverlayClick() {
      // Don't allow closing modal by clicking overlay
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

.modal {
  background: var(--color-bg);
  padding: 32px;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.modal h2 {
  margin-bottom: 8px;
  color: var(--color-text);
}

.modal p {
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}

.token-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 16px;
}

.token-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.button-group {
  display: flex;
  justify-content: flex-end;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
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

.error {
  color: var(--color-primary);
  font-size: 14px;
  margin-top: 16px;
}

/* Mobile auth modal styles */
@media (max-width: 480px) {
  .modal {
    padding: 24px;
    width: 95%;
    max-width: none;
    margin: 16px;
  }

  .modal h2 {
    font-size: 20px;
  }

  .token-input {
    padding: 14px;
    font-size: 16px; /* Prevents iOS zoom */
    border-radius: 8px;
  }

  .button-group {
    justify-content: center;
  }

  .btn {
    width: 100%;
    padding: 14px 24px;
    font-size: 16px;
    border-radius: 8px;
  }
}
</style>
