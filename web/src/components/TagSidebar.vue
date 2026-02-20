<template>
  <aside class="tag-sidebar">
    <div class="app-title" @click="$emit('select', null)" title="Go to Inbox">
      <button class="close-sidebar-btn" @click.stop="$emit('close')" title="Close menu" aria-label="Close menu">
        <svg viewBox="0 0 24 24" class="close-icon" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <h1>Inboxer</h1>
    </div>

    <button type="button" class="compose-btn" @click="$emit('compose')">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>Compose</span>
    </button>

    <div class="tag-header">
      <h2>Tags</h2>
      <button class="add-btn" @click="showAdd = !showAdd" aria-label="Add Tag">+</button>
    </div>

    <!-- Inbox -->
    <div
      class="tag-item inbox-item"
      :class="{ active: selectedTag === null && !settingsActive }"
      role="button"
      tabindex="0"
      aria-label="Go to Inbox"
      :aria-current="(selectedTag === null && !settingsActive) ? 'page' : undefined"
      @click="$emit('select', null)"
      @keydown.enter.prevent="$emit('select', null)"
      @keydown.space.prevent="$emit('select', null)"
    >
      <div class="tag-content">
        <div class="tag-info">
          <span class="tag-dot"></span>
          <span class="tag-label">Inbox</span>
        </div>
      </div>
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
        v-for="tag in userTags" 
        :key="tag.id" 
        class="tag-item"
        :class="{ active: selectedTag === tag.name && !settingsActive }"
        role="button"
        tabindex="0"
        :aria-label="'Select tag ' + tag.label"
        :aria-current="(selectedTag === tag.name && !settingsActive) ? 'page' : undefined"
        @click="handleSelectTag(tag.name)"
        @keydown.enter.prevent="handleSelectTag(tag.name)"
        @keydown.space.prevent="handleSelectTag(tag.name)"
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
              <span v-if="tag.count != null && tag.count !== 0" class="tag-count">({{ tag.count }})</span>
            </div>
            
            <div class="tag-actions">
              <button 
                class="action-btn edit-btn" 
                @click.stop="startRename(tag)"
                title="Rename"
                aria-label="Rename Tag"
              >✎</button>
              <button 
                class="action-btn delete-btn" 
                @click.stop="handleDeleteTag(tag.id)"
                title="Delete"
                aria-label="Delete Tag"
              >&times;</button>
            </div>
        </div>
      </li>
    </ul>

    <!-- Todoist Projects -->
    <div v-if="hasTodoistToken" class="todoist-section">
      <div class="tag-header">
        <h2>Todoist</h2>
      </div>
      <div v-if="loadingTodoistProjects" class="todoist-loading">Loading projects...</div>
      <ul v-else class="todoist-project-list">
        <li
          v-for="node in todoistProjectsFlat"
          :key="node.project.id"
          class="todoist-project-node"
        >
          <div
            class="tag-item todoist-project-item"
            :class="{ 'has-children': node.hasChildren }"
            :style="{ paddingLeft: `${node.depth * 12 + 16}px` }"
            @dragover="onDragOver($event)"
            @drop="onDropTodoist($event, node.project)"
            @click="handleTodoistProjectClick(node)"
          >
            <div class="tag-content">
              <div class="tag-info">
                <button
                  v-if="node.hasChildren"
                  type="button"
                  class="todoist-expand-btn"
                  :class="{ expanded: node.expanded }"
                  :aria-label="node.expanded ? 'Collapse' : 'Expand'"
                  @click.stop="toggleTodoistExpanded(node.project.id)"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                    <path d="M8 10l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <span v-else class="todoist-expand-spacer"></span>
                <svg class="tag-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75"/>
                  <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                </svg>
                <span class="tag-label" :title="node.project.name">{{ node.project.name }}</span>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <div class="sidebar-footer">
      <div class="system-tags">
        <div
          class="tag-item"
          :class="{ active: selectedTag === 'sent' && !settingsActive }"
          role="button"
          tabindex="0"
          aria-label="Sent Messages"
          :aria-current="(selectedTag === 'sent' && !settingsActive) ? 'page' : undefined"
          @click="$emit('select', 'sent')"
          @keydown.enter.prevent="$emit('select', 'sent')"
          @keydown.space.prevent="$emit('select', 'sent')"
        >
          <div class="tag-content">
            <div class="tag-info">
              <svg class="tag-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="tag-label">Sent</span>
              <span v-if="sentCount != null && sentCount !== 0" class="tag-count">({{ sentCount }})</span>
            </div>
          </div>
        </div>
        <div
          class="tag-item"
          :class="{ active: selectedTag === 'archive' && !settingsActive }"
          role="button"
          tabindex="0"
          aria-label="Archive (Done)"
          :aria-current="(selectedTag === 'archive' && !settingsActive) ? 'page' : undefined"
          @click="$emit('select', 'archive')"
          @keydown.enter.prevent="$emit('select', 'archive')"
          @keydown.space.prevent="$emit('select', 'archive')"
          @dragover="onDragOver($event)"
          @drop="onDropSystem($event, 'archive')"
        >
          <div class="tag-content">
            <div class="tag-info">
              <svg class="tag-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.75"/>
                <path d="M7 12l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="tag-label">Done</span>
              <span v-if="archiveCount != null && archiveCount !== 0" class="tag-count">({{ archiveCount }})</span>
            </div>
          </div>
        </div>
        <div
          class="tag-item"
          :class="{ active: selectedTag === 'spam' && !settingsActive }"
          role="button"
          tabindex="0"
          aria-label="Spam Folder"
          :aria-current="(selectedTag === 'spam' && !settingsActive) ? 'page' : undefined"
          @click="$emit('select', 'spam')"
          @keydown.enter.prevent="$emit('select', 'spam')"
          @keydown.space.prevent="$emit('select', 'spam')"
          @dragover="onDragOver($event)"
          @drop="onDropSystem($event, 'spam')"
        >
          <div class="tag-content">
            <div class="tag-info">
              <span class="tag-icon">🚫</span>
              <span class="tag-label">Spam</span>
              <span v-if="spamCount != null && spamCount !== 0" class="tag-count">({{ spamCount }})</span>
            </div>
          </div>
        </div>
      </div>
      <div
        class="tag-item settings-item"
        :class="{ active: settingsActive }"
        role="button"
        tabindex="0"
        aria-label="Settings"
        :aria-current="settingsActive ? 'page' : undefined"
        @click="$emit('settings')"
        @keydown.enter.prevent="$emit('settings')"
        @keydown.space.prevent="$emit('settings')"
      >
        <div class="tag-content">
          <div class="tag-info">
            <span class="tag-icon">⚙️</span>
            <span class="tag-label">Settings</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script>
import { getTags, createTag, deleteTag, updateTag, updateMessageTag, archiveMessage, getTodoistProjects, addTodoistTask } from '../services/api.js';
import { hasTodoistToken } from '../services/auth.js';

export default {
  name: 'TagSidebar',
  props: {
    selectedTag: String,
    messageCounts: {
      type: Object,
      default: null
    },
    settingsActive: {
      type: Boolean,
      default: false
    }
  },
  emits: ['select', 'settings', 'close', 'compose', 'todoist-added'],
  data() {
    return {
      tags: [],
      newTagName: '',
      showAdd: false,
      draggedTag: null,
      editingTagId: null,
      editName: '',
      todoistProjects: [],
      loadingTodoistProjects: false,
      expandedTodoistProjects: new Set()
    };
  },
  computed: {
    hasTodoistToken() {
      return hasTodoistToken();
    },
    inboxCount() {
      return this.messageCounts?.inbox ?? null;
    },
    archiveCount() {
      return this.messageCounts?.archive ?? null;
    },
    spamCount() {
      return this.messageCounts?.spam ?? null;
    },
    sentCount() {
      return this.messageCounts?.sent ?? null;
    },
    userTags() {
      // Sort tags alphabetically by name, exclude system tags (Spam, Sent)
      const sorted = this.tags
        .filter(t => t.name !== 'Spam' && t.name !== 'Sent')
        .sort((a, b) => a.name.localeCompare(b.name));

      return sorted.map(tag => {
        const parts = tag.name.split('/');
        return {
          ...tag,
          label: parts[parts.length - 1],
          count: this.messageCounts?.tags?.[tag.name] ?? null,
          depth: parts.length - 1
        };
      });
    },
    todoistProjectTree() {
      const projects = this.todoistProjects || [];
      const parentId = (p) => p.parent_id ?? p.parentId ?? null;
      const order = (p) => p.order ?? 0;

      const byParent = new Map();
      byParent.set(null, []);
      for (const p of projects) {
        const pid = parentId(p);
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(p);
      }
      for (const arr of byParent.values()) {
        arr.sort((a, b) => order(a) - order(b));
      }

      const buildNode = (project, depth = 0) => {
        const children = (byParent.get(String(project.id)) || [])
          .map((p) => buildNode(p, depth + 1));
        return { project, children, depth };
      };

      return (byParent.get(null) || []).map((p) => buildNode(p, 0));
    },
    todoistProjectsFlat() {
      const expanded = this.expandedTodoistProjects;
      const flatten = (nodes) => {
        const out = [];
        for (const node of nodes) {
          const hasChildren = node.children.length > 0;
          const isExpanded = hasChildren && expanded.has(String(node.project.id));
          out.push({
            project: node.project,
            depth: node.depth,
            hasChildren,
            expanded: isExpanded
          });
          if (hasChildren && isExpanded) {
            out.push(...flatten(node.children));
          }
        }
        return out;
      };
      return flatten(this.todoistProjectTree);
    }
  },
  watch: {
    settingsActive(active) {
      if (!active && this.hasTodoistToken) {
        this.loadTodoistProjects();
      }
    }
  },
  async created() {
    await this.loadTags();
    if (this.hasTodoistToken) {
      await this.loadTodoistProjects();
    }
  },
  methods: {
    async loadTags() {
      try {
        const res = await getTags();
        this.tags = res || [];
        // Spam is handled manually now if we keep it in DB, 
        // but we filter it out of user list.
      } catch (e) {
        console.error('Failed to load tags', e);
      }
    },
    async loadTodoistProjects() {
      if (!this.hasTodoistToken) return;
      this.loadingTodoistProjects = true;
      try {
        this.todoistProjects = await getTodoistProjects();
      } catch (e) {
        console.error('Failed to load Todoist projects:', e);
        this.todoistProjects = [];
      } finally {
        this.loadingTodoistProjects = false;
      }
    },
    isTodoistExpanded(projectId) {
      return this.expandedTodoistProjects.has(String(projectId));
    },
    toggleTodoistExpanded(projectId) {
      const id = String(projectId);
      const next = new Set(this.expandedTodoistProjects);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      this.expandedTodoistProjects = next;
    },
    handleTodoistProjectClick(node) {
      this.openTodoistProject(node.project);
    },
    openTodoistProject(project) {
      const url = project.url || `https://app.todoist.com/app/project/${project.id}`;
      window.open(url, '_blank', 'noopener');
    },
    async onDropTodoist(event, project) {
      event.preventDefault();
      event.stopPropagation();
      const messageId = event.dataTransfer.getData('application/x-message-id');
      if (!messageId) return;

      try {
        const response = await addTodoistTask(messageId, { projectId: project.id });
        const projectName = response?.project?.name || project.name;
        this.$emit('todoist-added', { messageId, projectName, project });
      } catch (e) {
        alert('Failed to add to Todoist: ' + (e.message || 'Unknown error'));
      }
    },

    handleSelectTag(name) {
      this.$emit('select', name);
    },

    async handleAddTag() {
      if (!this.newTagName) return;
      try {
        const newTag = await createTag(this.newTagName);
        this.newTagName = '';
        this.showAdd = false;
        // Optimistically add tag locally
        this.tags.push(newTag);
      } catch (e) {
        alert('Failed to create tag: ' + e.message);
      }
    },

    async handleDeleteTag(id) {
      if (!confirm('Delete this tag?')) return;
      try {
        await deleteTag(id);
        this.tags = this.tags.filter(t => t.id !== id);
      } catch (e) {
        alert('Failed to delete tag: ' + e.message);
      }
    },

    startRename(tag) {
      this.editingTagId = tag.id;
      this.editName = tag.label;
      this.$nextTick(() => {
        const inputs = this.$refs.editInput;
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

      const parts = tag.name.split('/');
      parts.pop(); 
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

        // 1. Handle Message Drop (Tagging)
        const messageId = event.dataTransfer.getData('application/x-message-id');
        if (messageId) {
            if (confirm(`Apply tag "${targetTag.label}" to the dropped message?`)) {
                try {
                    await updateMessageTag(messageId, targetTag.name);
                    alert(`Tag "${targetTag.label}" applied.`);
                } catch (e) {
                    alert('Failed to apply tag: ' + e.message);
                }
            }
            return;
        }

        // 2. Handle Tag Drop (Reordering/Nesting)
        const dragged = this.draggedTag;
        this.draggedTag = null;
        
        if (!dragged || dragged.id === targetTag.id) return;

        if (targetTag.name.startsWith(dragged.name + '/')) {
            alert("Cannot move a parent tag into its own child.");
            return;
        }

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
    },
    
    async onDropSystem(event, type) {
        event.preventDefault();
        const messageId = event.dataTransfer.getData('application/x-message-id');
        if (!messageId) return;

        if (type === 'archive') {
            try {
                await archiveMessage(messageId);
            } catch (e) {
                alert('Failed to mark as done: ' + e.message);
            }
        } else if (type === 'spam') {
            if (confirm('Mark this message as Spam?')) {
                try {
                     await updateMessageTag(messageId, 'Spam');
                     alert('Marked as Spam.');
                } catch (e) {
                    alert('Failed to mark as Spam: ' + e.message);
                }
            }
        }
    }
  }
};
</script>

<style scoped>
.tag-sidebar {
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-title {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
  align-items: center;
}

.app-title h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary, #db4c3f);
  flex: 1;
}

.compose-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 12px 16px;
  padding: 10px 16px;
  background: var(--color-primary, #db4c3f);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.compose-btn:hover {
  background: var(--color-primary-dark, #c53727);
}

.compose-btn svg {
  flex-shrink: 0;
}

.tag-header {
  padding: 12px 16px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tag-header h2 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.add-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--color-text-secondary);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.add-btn:hover {
  background: var(--color-bg-hover);
}

.add-container {
  padding: 0 16px 8px;
}

.add-container input {
  width: 100%;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
}

.tag-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
}

.todoist-section {
  border-top: 1px solid var(--color-border);
  padding-top: 4px;
}

.todoist-loading {
  padding: 8px 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.todoist-project-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.todoist-project-node {
  list-style: none;
}

.todoist-expand-btn {
  width: 16px;
  height: 16px;
  padding: 0;
  margin: 0 4px 0 0;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  flex-shrink: 0;
  transition: transform 0.15s;
}

.todoist-expand-btn.expanded {
  transform: rotate(-90deg);
}

.todoist-expand-btn:hover {
  opacity: 0.8;
}

.todoist-expand-spacer {
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 4px;
  flex-shrink: 0;
}

.todoist-project-item .tag-dot {
  display: none;
}

.sidebar-footer {
  padding-bottom: 8px;
}

.settings-item {
  margin-top: 4px;
}

.system-tags {
  border-top: 1px solid var(--color-border);
  padding-top: 4px;
}

.tag-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 14px;
  color: var(--color-text);
  border-left: 3px solid transparent;
}

.tag-item:hover,
.tag-item:focus-visible {
  background: var(--color-bg-hover);
}

.tag-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.tag-item.active {
  background: var(--color-bg-hover);
  border-left-color: var(--color-primary, #007bff);
  color: var(--color-text);
  font-weight: 500;
}

.tag-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--color-text-secondary);
  border-radius: 50%;
  margin-right: 8px;
}

.tag-icon {
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

.tag-count {
  margin-left: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
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
  background: var(--color-bg);
  color: var(--color-text);
}

.tag-actions {
  display: none;
  gap: 4px;
}

.tag-item:hover .tag-actions,
.tag-item:focus-within .tag-actions {
  display: flex;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  color: var(--color-text-secondary);
  border-radius: 4px;
}

.action-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.delete-btn:hover {
  color: var(--color-primary);
}

/* Close button - hidden on desktop */
.close-sidebar-btn {
  display: none;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--color-text-secondary);
}

.close-sidebar-btn:hover {
  background: var(--color-bg-hover);
}

.close-icon {
  width: 20px;
  height: 20px;
}

@media (max-width: 768px) {
  .close-sidebar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app-title {
    padding: 12px 16px;
  }
}
</style>
