<template>
  <div class="kanban-view">
    <h2 class="kanban-title">Kanban</h2>
  </div>
</template>

<script>
export default {
  name: 'KanbanView'
};
</script>

<style scoped>
.kanban-view {
  grid-column: 3 / 6;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  color: var(--color-text-secondary);
}

.kanban-title {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
  color: var(--color-text-secondary);
}
</style>
