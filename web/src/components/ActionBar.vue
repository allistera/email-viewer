<template>
  <div class="action-bar">
    <div class="filters-section">
      <div class="filters-list">
        <button class="filter-add" @click="$emit('add-tag')">
          + New Tag
        </button>
      </div>
    </div>

    <div class="actions-section">
      <button
        class="btn-action"
        :disabled="!hasSelection"
        @click="$emit('archive')"
        title="Archive message"
      >
        📦 Archive
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ActionBar',
  props: {
    hasSelection: {
      type: Boolean,
      default: false
    }
  }
};
</script>

<style scoped>
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  gap: 16px;
}

.filters-section {
  flex: 1;
  min-width: 0;
}

.filters-list {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-chip:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
}

.filter-chip.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.filter-remove {
  font-size: 16px;
  font-weight: bold;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.filter-remove:hover {
  opacity: 1;
}

.filter-chip.active .filter-remove {
  opacity: 0.9;
}

.filter-chip.active .filter-remove:hover {
  opacity: 1;
}

.filter-add {
  padding: 6px 12px;
  border: 1px dashed var(--color-border);
  border-radius: 16px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-add:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-bg-secondary);
}

.actions-section {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-action {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-action:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
}

.btn-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .action-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .actions-section {
    justify-content: flex-end;
  }
}
</style>
