<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`]"
      >
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" @click="removeToast(toast.id)">&times;</button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script>
export default {
  name: 'ToastNotification',
  data() {
    return {
      toasts: [],
      nextId: 0
    };
  },
  methods: {
    show(message, type = 'success', duration = 3000) {
      const id = this.nextId++;
      this.toasts.push({ id, message, type });
      
      if (duration > 0) {
        setTimeout(() => {
          this.removeToast(id);
        }, duration);
      }
    },
    removeToast(id) {
      this.toasts = this.toasts.filter(t => t.id !== id);
    },
    success(message, duration) {
      this.show(message, 'success', duration);
    },
    error(message, duration) {
      this.show(message, 'error', duration);
    },
    info(message, duration) {
      this.show(message, 'info', duration);
    }
  }
};
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 14px;
  pointer-events: auto;
  min-width: 200px;
  max-width: 400px;
}

.toast-success {
  background: var(--color-success, #058527);
  color: #fff;
}

.toast-error {
  background: var(--color-primary, #db4c3f);
  color: #fff;
}

.toast-info {
  background: #333;
  color: #fff;
}

.toast-message {
  flex: 1;
}

.toast-close {
  background: none;
  border: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
}

.toast-close:hover {
  opacity: 1;
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

@media (max-width: 768px) {
  .toast-container {
    left: 16px;
    right: 16px;
    transform: none;
  }

  .toast {
    max-width: none;
  }
}
</style>
