const STORAGE_KEY = 'email_templates';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(templates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch { /* ignore quota errors */ }
}

function generateId() {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listTemplates() {
  return readAll().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export function getTemplate(id) {
  if (!id) return null;
  return readAll().find(t => t.id === id) || null;
}

export function saveTemplate({ id, name, subject = '', body = '' }) {
  const cleanName = (name || '').trim();
  if (!cleanName) return null;
  const templates = readAll();
  const idx = id ? templates.findIndex(t => t.id === id) : -1;
  const updatedAt = Date.now();
  if (idx >= 0) {
    templates[idx] = { ...templates[idx], name: cleanName, subject, body, updatedAt };
    writeAll(templates);
    return templates[idx].id;
  }
  const newId = id || generateId();
  templates.push({ id: newId, name: cleanName, subject, body, updatedAt });
  writeAll(templates);
  return newId;
}

export function deleteTemplate(id) {
  if (!id) return;
  writeAll(readAll().filter(t => t.id !== id));
}
