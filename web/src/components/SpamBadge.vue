<template>
  <span :class="['badge', `badge-${status}`]">
    {{ label }}
  </span>
</template>

<script>
export default {
  name: 'SpamBadge',
  props: {
    status: {
      type: String,
      required: true,
      validator: (value) => ['spam', 'ham', 'unknown'].includes(value)
    },
    confidence: {
      type: Number,
      default: null
    }
  },
  computed: {
    label() {
      if (this.status === 'spam') return 'Spam';
      if (this.status === 'ham') return 'Safe';
      return 'Unknown';
    }
  }
};
</script>

<style scoped>
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-spam {
  background: #ffe0e0;
  color: var(--color-primary);
}

.badge-ham {
  background: #e0f5e9;
  color: var(--color-success);
}

.badge-unknown {
  background: #fff3e0;
  color: var(--color-warning);
}
</style>
