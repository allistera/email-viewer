<template>
  <Transition name="slideout">
    <div v-if="show" class="todoist-slideout" role="complementary" aria-label="Todoist Projects">
      <div class="slideout-header">
        <div class="slideout-title">
          <svg class="todoist-logo" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.75"/>
            <path d="M7 12l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2>Todoist</h2>
        </div>
        <button type="button" class="close-btn" @click="$emit('close')" aria-label="Close Todoist panel">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div v-if="loadingProjects" class="loading-state">
        <span>Loading projects...</span>
      </div>

      <div v-else-if="!projectsFlat.length" class="empty-state">
        <p>No projects found.</p>
      </div>

      <ul v-else class="project-list" aria-label="Todoist projects">
        <li
          v-for="node in projectsFlat"
          :key="node.project.id"
          class="project-node"
        >
          <div
            class="project-item"
            :class="{ 'has-children': node.hasChildren }"
            :style="{ paddingLeft: `${node.depth * 14 + 16}px` }"
            @dragover="onDragOver($event)"
            @drop="onDrop($event, node.project)"
            @click="openProject(node.project)"
            role="button"
            tabindex="0"
            :title="node.project.name"
            @keydown.enter.self.prevent="openProject(node.project)"
            @keydown.space.self.prevent="openProject(node.project)"
          >
            <button
              v-if="node.hasChildren"
              type="button"
              class="expand-btn"
              :class="{ expanded: node.expanded }"
              :aria-label="node.expanded ? 'Collapse' : 'Expand'"
              @click.stop="toggleExpanded(node.project.id)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                <path d="M8 10l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <span v-else class="expand-spacer"></span>

            <svg class="project-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75"/>
            </svg>
            <span class="project-name">{{ node.project.name }}</span>
          </div>
        </li>
      </ul>

      <div class="slideout-footer">
        <p class="drop-hint">Drag an email onto a project to add it as a task</p>
      </div>
    </div>
  </Transition>
</template>

<script>
import { getTodoistProjects, addTodoistTask } from '../services/api.js';
import { hasTodoistToken } from '../services/auth.js';

export default {
  name: 'TodoistSlideout',
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'todoist-added'],
  data() {
    return {
      projects: [],
      loadingProjects: false,
      expandedProjects: new Set()
    };
  },
  computed: {
    projectTree() {
      const projects = this.projects || [];
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
    projectsFlat() {
      const expanded = this.expandedProjects;
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
      return flatten(this.projectTree);
    }
  },
  watch: {
    show(val) {
      if (val && !this.projects.length) {
        this.load();
      }
    }
  },
  methods: {
    async load() {
      if (!hasTodoistToken()) return;
      this.loadingProjects = true;
      try {
        this.projects = await getTodoistProjects();
      } catch (e) {
        console.error('Failed to load Todoist projects:', e);
        this.projects = [];
      } finally {
        this.loadingProjects = false;
      }
    },
    toggleExpanded(projectId) {
      const id = String(projectId);
      const next = new Set(this.expandedProjects);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      this.expandedProjects = next;
    },
    openProject(project) {
      const url = project.url || `https://app.todoist.com/app/project/${project.id}`;
      window.open(url, '_blank', 'noopener');
    },
    onDragOver(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    async onDrop(event, project) {
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
    }
  }
};
</script>

<style scoped>
.todoist-slideout {
  position: fixed;
  top: 0;
  right: var(--right-rail-width, 72px);
  height: 100%;
  width: 260px;
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.08);
}

/* Slide transition */
.slideout-enter-active,
.slideout-leave-active {
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease;
}

.slideout-enter-from,
.slideout-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.slideout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px 14px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.slideout-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slideout-title h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.todoist-logo {
  color: var(--color-primary, #db4c3f);
  flex-shrink: 0;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.loading-state,
.empty-state {
  padding: 24px 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
}

.project-list {
  list-style: none;
  padding: 6px 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
}

.project-node {
  list-style: none;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 7px 16px;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--color-text);
  border-radius: 0;
  transition: background 0.12s;
  user-select: none;
}

.project-item:hover {
  background: var(--color-bg-hover);
}

.project-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.expand-btn {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  transition: transform 0.15s;
  border-radius: 3px;
}

.expand-btn.expanded {
  transform: rotate(-90deg);
}

.expand-btn:hover {
  background: var(--color-bg-hover);
}

.expand-spacer {
  display: inline-block;
  width: 16px;
  flex-shrink: 0;
}

.project-icon {
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.project-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  flex: 1;
}

.slideout-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.drop-hint {
  margin: 0;
  font-size: 11.5px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}
</style>
