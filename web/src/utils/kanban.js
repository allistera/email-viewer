/**
 * Normalize a tag string to a canonical kanban lane ID.
 * Returns 'todo', 'in-progress', 'done', or null if the tag is not a lane tag.
 */
export function normalizeKanbanLaneTag(tag) {
  const raw = String(tag || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'todo' || raw === 'to-do') return 'todo';
  if (raw === 'in-progress' || raw === 'in progress' || raw === 'inprogress') return 'in-progress';
  if (raw === 'done') return 'done';
  return null;
}

export function isKanbanLaneTag(tag) {
  return normalizeKanbanLaneTag(tag) !== null;
}
