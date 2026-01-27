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
  name: 'TagSidebar',
  props: {
    selectedTag: String
  },
  data() {
    return {
      tags: [],
      newTagName: '',
      showAdd: false,
      draggedTag: null,
      editingTagId: null,
      editName: ''
    };
  },
  computed: {
    displayTags() {
      // Sort tags alphabetically by name
      const sorted = [...this.tags].sort((a, b) => a.name.localeCompare(b.name));
      
      return sorted.map(tag => {
        const parts = tag.name.split('/');
        return {
          ...tag,
          label: parts[parts.length - 1],
          depth: parts.length - 1
        };
      });
    }
  },
  async created() {
    await this.loadTags();
  },
  methods: {
    async loadTags() {
      try {
        const res = await getTags();
        this.tags = res || [];
      } catch (e) {
        console.error('Failed to load tags', e);
      }
    },

    handleSelectTag(name) {
      this.$emit('select', name);
    },

    userCreated(tag) {
      return tag.name !== 'Spam';
    },

    async handleAddTag() {
      if (!this.newTagName) return;
      try {
        await createTag(this.newTagName);
        this.newTagName = '';
        this.showAdd = false;
        await this.loadTags();
      } catch (e) {
        alert('Failed to create tag: ' + e.message);
      }
    },

    async handleDeleteTag(id) {
      if (!confirm('Delete this tag?')) return;
      try {
        await deleteTag(id);
        await this.loadTags();
      } catch (e) {
        alert('Failed to delete tag: ' + e.message);
      }
    },

    startRename(tag) {
      this.editingTagId = tag.id;
      this.editName = tag.label;
      this.$nextTick(() => {
        const inputs = this.$refs.editInput;
        // In v-for ref is an array if multiple, but here inside li
        if (inputs && inputs.length > 0) {
            inputs[0].focus();
        } else if (inputs && inputs.focus) {
            inputs.focus();
        } else if (Array.isArray(inputs) && inputs[0]) { 
             inputs[0].focus();
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

    onDragStart(event, tag) {
        this.draggedTag = tag;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', tag.id);
    },

    onDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        return false;
    },

    async onDrop(event, targetTag) {
        event.preventDefault();
        const dragged = this.draggedTag;
        this.draggedTag = null;
        
        if (!dragged || dragged.id === targetTag.id) return;

        // Prevent dropping parent into child (circular dependency)
        if (targetTag.name.startsWith(dragged.name + '/')) {
            alert("Cannot move a parent tag into its own child.");
            return;
        }

        // New name: target/draggedLabel
        const parts = dragged.name.split('/');
        const label = parts[parts.length - 1];
        const newName = `${targetTag.name}/${label}`;

        if (confirm(`Move "${label}" into "${targetTag.label}"?`)) {
            try {
                await updateTag(dragged.id, newName);
                await this.loadTags();
            } catch (e) {
                alert('Failed to move tag: ' + e.message);
            }
        }
    }
  }
};
</script>

<style scoped>
.tag-sidebar {
  width: 200px;
  background: #f5f5f5;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tag-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tag-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.add-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.add-btn:hover {
  background: rgba(0,0,0,0.1);
}

.add-container {
  padding: 0 16px 8px;
}

.add-container input {
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.tag-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
}

.tag-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #555;
  border-left: 3px solid transparent;
}

.tag-item:hover {
  background: #eaeaea;
}

.tag-item.active {
  background: #e0e0e0;
  border-left-color: var(--color-primary, #007bff);
  color: #333;
  font-weight: 500;
}

.tag-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #ccc;
  border-radius: 50%;
  margin-right: 8px;
}

.tag-item.active .tag-dot {
  background: var(--color-primary, #007bff);
}

.tag-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.tag-info {
  display: flex;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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
