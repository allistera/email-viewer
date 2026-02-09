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
        :class="{ 'drag-over': dragOverLane === lane.id }"
        @dragover.prevent="onDragOver($event, lane.id)"
        @dragleave="onDragLeave($event, lane.id)"
        @drop="onDrop($event, lane.id)"
      >
        <div class="lane-header">
          <span class="lane-dot" :style="{ background: lane.color }"></span>
          <h3 class="lane-title">{{ lane.title }}</h3>
          <span class="lane-count">{{ getLaneCount(lane.id) }}</span>
        </div>
        <div class="lane-cards">
          <div
            v-for="message in getMessagesForLane(lane.id)"
            :key="message.id"
            class="kanban-card"
            @click="$emit('select-message', message.id)"
          >
            <div class="card-header">
              <span class="card-from">{{ message.from }}</span>
              <span class="card-time">{{ formatTime(message.receivedAt) }}</span>
            </div>
            <div class="card-content">{{ message.subject || '(No subject)' }}</div>
            <div class="card-snippet">{{ message.snippet }}</div>
          </div>
          <div v-if="getMessagesForLane(lane.id).length === 0" class="lane-empty">
            <span class="empty-hint">Drop emails here</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { formatRelativeDate } from '../utils/dateFormat.js';
import { updateMessageTag } from '../services/api.js';

export default {
  name: 'KanbanView',
  props: {
    messages: {
      type: Array,
      default: () => []
    }
  },
  emits: ['message-dropped', 'select-message'],
  data() {
    return {
      lanes: [
        { id: 'todo', title: 'Todo', color: 'var(--color-text-secondary)' },
        { id: 'in-progress', title: 'In Progress', color: 'var(--color-warning)' },
        { id: 'done', title: 'Done', color: 'var(--color-success)' }
      ],
      dragOverLane: null
    };
  },
  methods: {
    getMessagesForLane(laneId) {
      // Map lane IDs to tag names
      const tagMap = {
        'todo': 'todo',
        'in-progress': 'in-progress',
        'done': 'done'
      };
      const tag = tagMap[laneId];
      if (!tag) return [];
      
      // Filter messages that have this tag
      return this.messages.filter((msg) => msg.tag === tag);
    },
    getLaneCount(laneId) {
      return this.getMessagesForLane(laneId).length;
    },
    formatTime(timestamp) {
      return formatRelativeDate(timestamp);
    },
    onDragOver(event, laneId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      this.dragOverLane = laneId;
    },
    onDragLeave(event, laneId) {
      // Only clear drag-over state if we're actually leaving the lane
      // (not just moving to a child element)
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;
      
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        this.dragOverLane = null;
      }
    },
    async onDrop(event, laneId) {
      event.preventDefault();
      this.dragOverLane = null;
      
      // Get the message ID from the drag data
      const messageId = event.dataTransfer.getData('application/x-message-id');
      if (!messageId) {
        // Fallback: try text/plain if custom format not available
        const textData = event.dataTransfer.getData('text/plain');
        if (textData) {
          // Try to find message by subject
          const message = this.messages.find(m => m.subject === textData);
          if (message) {
            await this.handleMessageDrop(message.id, laneId);
          }
        }
        return;
      }
      
      await this.handleMessageDrop(messageId, laneId);
    },
    async handleMessageDrop(messageId, laneId) {
      // Map lane IDs to tag names
      const tagMap = {
        'todo': 'todo',
        'in-progress': 'in-progress',
        'done': 'done'
      };
      const newTag = tagMap[laneId];
      
      if (!newTag) {
        console.error('Unknown lane:', laneId);
        return;
      }
      
      try {
        // Update the message tag via API
        await updateMessageTag(messageId, newTag);
        
        // Emit event to parent to refresh messages
        this.$emit('message-dropped', { messageId, newTag });
      } catch (error) {
        console.error('Failed to update message tag:', error);
        // Could emit an error event here for toast notification
        this.$emit('drop-error', { messageId, error });
      }
    }
  }
};
</script>

<style scoped>
.kanban-view {
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
  overflow: hidden;
  min-height: 0;
}

.kanban-lane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border-radius: 12px;
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 8px var(--color-rail-shadow);
  overflow: hidden;
  transition: border-color 0.2s, background-color 0.2s;
}

.kanban-lane.drag-over {
  border-color: var(--color-primary);
  background: var(--color-bg-secondary);
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.card-from {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.card-time {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.card-content {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.4;
  margin-bottom: 4px;
}

.card-snippet {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.lane-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  background: transparent;
  transition: border-color 0.2s;
}

.kanban-lane.drag-over .lane-empty {
  border-color: var(--color-primary);
  background: rgba(219, 76, 63, 0.05);
}

.empty-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>
