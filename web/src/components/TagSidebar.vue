<template>
  <aside class="tag-sidebar">
    <div class="tag-header">
      <h2>Tags</h2>
      <button class="add-btn" @click="showAdd = !showAdd" aria-label="Add Tag">+</button>
    </div>

    <div v-if="showAdd" class="add-container">
      <input 
        v-model.trim="newTagName" 
        placeholder="New tag..." 
        @keyup.enter="handleAddTag"
        ref="input"
      >
    </div>

    <ul class="tag-list">
      <li 
        v-for="tag in displayTags" 
        :key="tag.id" 
        class="tag-item"
        :class="{ active: selectedTag === tag.name }"
        @click="handleSelectTag(tag.name)"
        draggable="true"
        @dragstart="onDragStart($event, tag)"
        @dragover="onDragOver($event)"
        @drop="onDrop($event, tag)"
      >
        <div class="tag-info" :style="{ paddingLeft: `${tag.depth * 12}px` }">
          <span class="tag-dot"></span>
          <span class="tag-label" :title="tag.name">{{ tag.label }}</span>
        </div>
        <button 
          v-if="userCreated(tag)" 
          class="delete-btn" 
          @click.stop="handleDeleteTag(tag.id)"
          aria-label="Delete Tag"
        >&times;</button>
      </li>
    </ul>
  </aside>
</template>

<script>
import { getTags, createTag, deleteTag, updateTag } from '../services/api.js';

export default {
  name: 'TagSidebar',
  emits: ['select'],
  props: {
    selectedTag: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      tags: [],
      newTagName: '',
      showAdd: false,
      defaultTags: ['Spam'],
      draggedTag: null
    };
  },
  computed: {
    displayTags() {
      // Sort keys to ensure parent always before child if needed? 
      // Actually standard sort by name handles it naturally for 'A' and 'A/B'.
      const sorted = [...this.tags].sort((a, b) => a.name.localeCompare(b.name));
      return sorted.map((tag) => {
        const parts = tag.name.split('/').filter(Boolean);
        const label = parts.length > 0 ? parts[parts.length - 1] : tag.name;
        return {
          ...tag,
          label,
          depth: Math.max(0, parts.length - 1)
        };
      });
    }
  },
  async mounted() {
    await this.loadTags();
  },
  methods: {
    async loadTags() {
      try {
        const remoteTags = await getTags();
        this.tags = this.ensureDefaultTags(remoteTags);
      } catch (e) {
        console.error('Failed to load tags', e);
      }
    },
    ensureDefaultTags(tags) {
      const defaultTags = this.defaultTags.map((name) => ({
        id: `default-${name.toLowerCase()}`,
        name
      }));
      const existingNames = new Set(tags.map((tag) => tag.name.toLowerCase()));
      const missingDefaultTags = defaultTags.filter(
        (tag) => !existingNames.has(tag.name.toLowerCase())
      );

      return [...missingDefaultTags, ...tags];
    },
    userCreated(tag) {
      return tag.name !== 'Spam';
    },
    async handleAddTag() {
      if (!this.newTagName) return;
      try {
        const tag = await createTag(this.newTagName);
        this.tags.push(tag);
        this.newTagName = '';
        this.showAdd = false;
      } catch (e) {
        alert('Failed to add tag');
      }
    },
    async handleDeleteTag(id) {
      if (!confirm('Delete this tag?')) return;
      try {
        await deleteTag(id);
        this.tags = this.tags.filter(t => t.id !== id);
      } catch (e) {
        alert('Failed to delete tag');
      }
    },
    handleSelectTag(tagName) {
      const nextSelection = this.selectedTag === tagName ? null : tagName;
      this.$emit('select', nextSelection);
    },

    // Drag and Drop Logic
    onDragStart(event, tag) {
      if (!this.userCreated(tag)) {
        event.preventDefault();
        return;
      }
      this.draggedTag = tag;
      event.dataTransfer.effectAllowed = 'move';
      // Store ID if needed, but we have component state
    },

    onDragOver(event) {
      event.preventDefault(); // Allow drop
      event.dataTransfer.dropEffect = 'move';
    },

    async onDrop(event, targetTag) {
      event.preventDefault();
      const dragged = this.draggedTag;
      this.draggedTag = null;

      if (!dragged || !targetTag) return;
      if (dragged.id === targetTag.id) return;
      
      // Prevent nesting inside itself
      if (targetTag.name.startsWith(dragged.name + '/')) return;

      const newName = `${targetTag.name}/${dragged.label}`;
      
      try {
        await updateTag(dragged.id, newName);
        await this.loadTags(); // Refresh to get updated list/order
      } catch (e) {
        alert('Failed to move tag: ' + e.message);
      }
    },
    
    // Allow dropping on header to move to root?
    async onDropCheckRoot(event) {
        // Advanced: Handle moving to root if needed
    }
  }
};
</script>

<style scoped>
.tag-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
  border-right: 1px solid var(--color-border);
}

.tag-header {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tag-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--color-text);
}

.add-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.add-container {
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border);
}

.add-container input {
  width: 100%;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.tag-list {
  list-style: none;
  margin: 0;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.tag-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  font-size: 14px;
  color: var(--color-text);
  cursor: pointer;
}

.tag-item:hover, .tag-item.active {
  background: var(--color-bg-secondary);
}

.tag-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}

.tag-label {
  text-transform: capitalize;
}

.delete-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  display: none;
}

.tag-item:hover .delete-btn {
  display: block;
}

.delete-btn:hover {
  color: #d9534f;
}
</style>
