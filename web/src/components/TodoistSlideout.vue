<template>
  <Transition name="slideout">
    <div v-if="show" class="todoist-slideout" role="complementary" aria-label="Todoist Tasks">
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

      <div class="slideout-body">
        <!-- Tasks section -->
        <div v-if="loadingTasks" class="loading-state">
          <span>Loading tasks...</span>
        </div>
        <div v-else-if="tasksError" class="error-state">
          <span>{{ tasksError }}</span>
          <button class="retry-btn" @click="loadTasks">Retry</button>
        </div>
        <div v-else>
          <!-- Today -->
          <div class="section-header">
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" class="section-icon">
              <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
            </svg>
            Today
            <span v-if="tasks.today.length" class="section-count">{{ tasks.today.length }}</span>
          </div>
          <div v-if="!tasks.today.length" class="empty-section">No tasks due today</div>
          <ul v-else class="task-list">
            <li v-for="task in tasks.today" :key="task.id" class="task-item">
              <button class="task-complete-btn" @click.stop="handleClose(task)" :title="'Complete: ' + task.content" aria-label="Complete task">
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </button>
              <span class="task-content" @click="openTask(task)" :title="task.content">{{ task.content }}</span>
              <span v-if="task.due?.datetime" class="task-time">{{ formatTime(task.due.datetime) }}</span>
            </li>
          </ul>

          <!-- Inbox -->
          <div class="section-header">
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" class="section-icon">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Inbox
            <span v-if="tasks.inbox.length" class="section-count">{{ tasks.inbox.length }}</span>
          </div>
          <div v-if="!tasks.inbox.length" class="empty-section">Inbox is empty</div>
          <ul v-else class="task-list">
            <li v-for="task in tasks.inbox" :key="task.id" class="task-item">
              <button class="task-complete-btn" @click.stop="handleClose(task)" :title="'Complete: ' + task.content" aria-label="Complete task">
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </button>
              <span class="task-content" @click="openTask(task)" :title="task.content">{{ task.content }}</span>
              <span v-if="task.due?.date" class="task-due">{{ formatDate(task.due.date) }}</span>
            </li>
          </ul>
        </div>

        <!-- Projects (for drag-and-drop) -->
        <div class="section-header projects-header" @click="projectsExpanded = !projectsExpanded" role="button" tabindex="0" @keydown.enter.prevent="projectsExpanded = !projectsExpanded">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" class="section-icon">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Projects
          <svg class="expand-chevron" :class="{ expanded: projectsExpanded }" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div v-if="projectsExpanded">
          <div v-if="loadingProjects" class="loading-state">Loading projects...</div>
          <div v-else-if="!projectsFlat.length" class="empty-section">No projects found.</div>
          <ul v-else class="project-list" aria-label="Todoist projects">
            <li
              v-for="node in projectsFlat"
              :key="node.project.id"
              class="project-node"
            >
              <div
                class="project-item"
                :class="{ 'has-children': node.hasChildren }"
                :style="{ paddingLeft: `${node.depth * 14 + 12}px` }"
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
                <svg class="project-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75"/>
                </svg>
                <span class="project-name">{{ node.project.name }}</span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div class="slideout-footer">
        <p class="drop-hint">Drag an email onto a project to add it as a task</p>
      </div>
    </div>
  </Transition>
</template>

<script>
import { getTodoistProjects, getTodoistTasks, addTodoistTask, closeTodoistTask } from '../services/api.js';
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
      tasks: { today: [], inbox: [] },
      loadingTasks: false,
      tasksError: null,
      projects: [],
      loadingProjects: false,
      projectsExpanded: false,
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
          out.push({ project: node.project, depth: node.depth, hasChildren, expanded: isExpanded });
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
      if (val) {
        this.load();
      }
    },
    projectsExpanded(val) {
      if (val && !this.projects.length && !this.loadingProjects) {
        this.loadProjects();
      }
    }
  },
  methods: {
    async load() {
      if (!hasTodoistToken()) return;
      await this.loadTasks();
    },
    async loadTasks() {
      this.loadingTasks = true;
      this.tasksError = null;
      try {
        const result = await getTodoistTasks();
        this.tasks = { today: result.today || [], inbox: result.inbox || [] };
      } catch (e) {
        console.error('Failed to load Todoist tasks:', e);
        this.tasksError = e.message || 'Failed to load tasks';
        this.tasks = { today: [], inbox: [] };
      } finally {
        this.loadingTasks = false;
      }
    },
    async loadProjects() {
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
    async handleClose(task) {
      // Optimistically remove from list
      this.tasks.today = this.tasks.today.filter(t => t.id !== task.id);
      this.tasks.inbox = this.tasks.inbox.filter(t => t.id !== task.id);
      try {
        await closeTodoistTask(task.id);
      } catch (e) {
        // Re-add on failure
        console.error('Failed to complete task:', e);
        await this.loadTasks();
      }
    },
    openTask(task) {
      const url = task.url || `https://app.todoist.com/app/task/${task.id}`;
      window.open(url, '_blank', 'noopener');
    },
    formatTime(datetime) {
      try {
        return new Date(datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return '';
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '';
      try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } catch {
        return dateStr;
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

.slideout-body {
  flex: 1;
  overflow-y: auto;
}

.loading-state,
.empty-section {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.error-state {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--color-error, #f23f43);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.retry-btn {
  align-self: flex-start;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.retry-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.projects-header {
  cursor: pointer;
  user-select: none;
  border-top: 1px solid var(--color-border);
  margin-top: 8px;
  padding-top: 12px;
}

.projects-header:hover {
  color: var(--color-text);
}

.section-icon {
  flex-shrink: 0;
}

.section-count {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
  border-radius: 10px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 600;
  min-width: 16px;
  text-align: center;
}

.expand-chevron {
  margin-left: auto;
  color: var(--color-text-secondary);
  transition: transform 0.15s;
}

.expand-chevron.expanded {
  transform: rotate(180deg);
}

/* Tasks */
.task-list {
  list-style: none;
  padding: 2px 0 4px;
  margin: 0;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 5px 10px;
  font-size: 13px;
  color: var(--color-text);
}

.task-item:hover {
  background: var(--color-bg-hover);
}

.task-complete-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
}

.task-complete-btn:hover {
  color: var(--color-primary, #db4c3f);
}

.task-content {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
  line-height: 1.3;
}

.task-content:hover {
  text-decoration: underline;
  color: var(--color-primary, #db4c3f);
}

.task-time,
.task-due {
  font-size: 11px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  white-space: nowrap;
}

/* Projects */
.project-list {
  list-style: none;
  padding: 4px 0;
  margin: 0;
}

.project-node {
  list-style: none;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text);
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
