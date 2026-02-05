<template>
  <div class="kanban-view">
    <header class="kanban-header">
      <h2 class="kanban-title">Kanban</h2>
    </header>
    <div class="kanban-board">
      <div
        v-for="lane in lanes"
        :key="lane.id"
        class="kanban-lane"
      >
        <div class="lane-header">
          <span class="lane-dot" :style="{ background: lane.color }"></span>
          <h3 class="lane-title">{{ lane.title }}</h3>
          <span class="lane-count">{{ getLaneCount(lane.id) }}</span>
        </div>
        <div class="lane-cards">
          <div
            v-for="card in getCardsForLane(lane.id)"
            :key="card.id"
            class="kanban-card"
          >
            <div class="card-content">{{ card.title }}</div>
          </div>
          <div v-if="getCardsForLane(lane.id).length === 0" class="lane-empty">
            <span class="empty-hint">No items</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'KanbanView',
  data() {
    return {
      lanes: [
        { id: 'todo', title: 'Todo', color: 'var(--color-text-secondary)' },
        { id: 'in-progress', title: 'In Progress', color: 'var(--color-warning)' },
        { id: 'done', title: 'Done', color: 'var(--color-success)' }
      ],
      cards: []
    };
  },
  methods: {
    getCardsForLane(laneId) {
      return this.cards.filter((c) => c.laneId === laneId);
    },
    getLaneCount(laneId) {
      return this.getCardsForLane(laneId).length;
    }
  }
};
</script>

<style scoped>
.kanban-view {
  grid-column: 3 / 6;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--color-bg-secondary);
}

.kanban-header {
  flex-shrink: 0;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

.kanban-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.kanban-board {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 24px;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 0;
}

.kanban-lane {
  flex: 0 0 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border-radius: 12px;
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 8px var(--color-rail-shadow);
  overflow: hidden;
}

.lane-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.lane-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.lane-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.01em;
  flex: 1;
}

.lane-count {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.lane-cards {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  min-height: 120px;
}

.kanban-card {
  padding: 12px 14px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.kanban-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(219, 76, 63, 0.12);
}

.kanban-card:last-child {
  margin-bottom: 0;
}

.card-content {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.4;
}

.lane-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  background: transparent;
}

.empty-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>
