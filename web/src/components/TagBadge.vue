<template>
  <span v-if="tag" :class="['badge', badgeClass]">
    {{ label }}
  </span>
</template>

<script>
export default {
  name: 'TagBadge',
  props: {
    tag: {
      type: String,
      default: null
    }
  },
  computed: {
    label() {
      if (!this.tag) return '';
      if (this.tag.toLowerCase() === 'spam') return 'Spam';
      return this.tag;
    },
    badgeClass() {
      if (!this.tag) return '';
      return this.tag.toLowerCase() === 'spam' ? 'badge-spam' : 'badge-tag';
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

.badge-tag {
  background: #e6f0ff;
  color: var(--color-text);
}
</style>
