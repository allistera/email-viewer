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
        <!-- Editing Mode -->
        <div v-if="editingTagId === tag.id" class="edit-mode" @click.stop>
          <input
            v-model="editName"
            @keyup.enter="finishRename"
            @keyup.esc="cancelRename"
            @blur="cancelRename"
            ref="editInput"
            class="edit-input"
          />
        </div>

        <!-- View Mode -->
        <div v-else class="tag-content">
            <div class="tag-info" :style="{ paddingLeft: `${tag.depth * 12}px` }">
              <span class="tag-dot"></span>
              <span class="tag-label" :title="tag.name">{{ tag.label }}</span>
            </div>
            
            <div v-if="userCreated(tag)" class="tag-actions">
              <button 
                class="action-btn edit-btn" 
                @click.stop="startRename(tag)"
                title="Rename"
              >✎</button>
              <button 
                class="action-btn delete-btn" 
                @click.stop="handleDeleteTag(tag.id)"
                title="Delete"
              >&times;</button>
            </div>
        </div>
      </li>
    </ul>
  </aside>
</template>

<script>
import { getTags, createTag, deleteTag, updateTag } from '../services/api.js';

export default {
// ...
  data() {
    return {
      tags: [],
      newTagName: '',
      showAdd: false,
      defaultTags: ['Spam'],
      draggedTag: null,
      editingTagId: null,
      editName: ''
    };
  },
// ...
    userCreated(tag) {
      return tag.name !== 'Spam';
    },

    startRename(tag) {
      this.editingTagId = tag.id;
      this.editName = tag.label;
      this.$nextTick(() => {
        const inputs = this.$refs.editInput;
        // In v-for ref is an array
        if (inputs && inputs.length > 0) {
            inputs[0].focus();
        } else if (inputs && inputs.focus) {
            inputs.focus();
        }
      });
    },

    cancelRename() {
      this.editingTagId = null;
      this.editName = '';
    },

    async finishRename() {
      if (!this.editingTagId || !this.editName.trim()) {
        this.cancelRename();
        return;
      }

      const tag = this.tags.find(t => t.id === this.editingTagId);
      if (!tag) return;

      if (this.editName === tag.label) {
        this.cancelRename();
        return;
      }

      // Reconstruct full name preserving parent hierarchy
      const parts = tag.name.split('/');
      parts.pop(); // Remove old label
      parts.push(this.editName.trim());
      const newFullName = parts.join('/');

      try {
        await updateTag(tag.id, newFullName);
        await this.loadTags();
      } catch (e) {
        alert('Failed to rename tag: ' + e.message);
      } finally {
        this.cancelRename();
      }
    },

    async handleAddTag() {
// ...
</script>

<style scoped>
/* ... existing styles ... */
.tag-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.edit-mode {
  width: 100%;
  padding: 0 4px;
}

.edit-input {
  width: 100%;
  padding: 4px;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  font-size: 13px;
}

.tag-actions {
  display: none;
  gap: 4px;
}

.tag-item:hover .tag-actions {
  display: flex;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  color: #999;
  border-radius: 4px;
}

.action-btn:hover {
  background-color: rgba(0,0,0,0.05);
  color: var(--color-text);
}

.delete-btn:hover {
  color: #d9534f;
}
</style>

