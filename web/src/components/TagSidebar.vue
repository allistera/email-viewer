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
        v-for="tag in tags" 
        :key="tag.id" 
        class="tag-item"
        :class="{ active: selectedTag === tag.name }"
        @click="$emit('select', tag.name)"
      >
        <div class="tag-info">
          <span class="tag-dot"></span>
          <span class="tag-label">{{ tag.name }}</span>
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
import { getTags, createTag, deleteTag } from '../services/api.js';

export default {
  name: 'TagSidebar',
  emits: ['select'],
  data() {
    return {
      tags: [],
      newTagName: '',
      showAdd: false,
      selectedTag: null,
      defaultTags: ['Spam']
    };
  },
  async mounted() {
    await this.loadTags();
  },
  methods: {
    async loadTags() {
      try {
        const remoteTags = await getTags();
        this.tags = remoteTags;
      } catch (e) {
        console.error('Failed to load tags', e);
      }
    },
    userCreated(tag) {
      // Assuming Spam is system reserved or handled specially, though "Spam" tag exists in DB logic?
      // Actually DB is simplified. Let's just allow deleting anything for now or exclude 'Spam'.
      return tag.name !== 'Spam'; // Example simple rule
    },
    async handleAddTag() {
      if (!this.newTagName) return;
      try {
        const tag = await createTag(this.newTagName);
        this.tags.unshift(tag); // Add to top
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
