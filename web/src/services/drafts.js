const STORAGE_KEY = 'email_drafts';
const LEGACY_KEY = 'compose_draft';

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

function writeAll(drafts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch { /* ignore quota errors */ }
}

function generateId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isEmpty({ recipients, subject, body }) {
  const hasRecipients = Array.isArray(recipients) && recipients.length > 0;
  const hasSubject = typeof subject === 'string' && subject.trim().length > 0;
  const hasBody = typeof body === 'string' && body.trim().length > 0;
  return !hasRecipients && !hasSubject && !hasBody;
}

export function listDrafts() {
  return readAll().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getDraft(id) {
  if (!id) return null;
  return readAll().find(d => d.id === id) || null;
}

export function saveDraft({ id, recipients = [], subject = '', body = '' }) {
  const drafts = readAll();
  const idx = id ? drafts.findIndex(d => d.id === id) : -1;

  if (isEmpty({ recipients, subject, body })) {
    if (idx >= 0) {
      drafts.splice(idx, 1);
      writeAll(drafts);
    }
    return null;
  }

  const updatedAt = Date.now();
  if (idx >= 0) {
    drafts[idx] = { ...drafts[idx], recipients, subject, body, updatedAt };
    writeAll(drafts);
    return drafts[idx].id;
  }

  const newId = id || generateId();
  drafts.push({ id: newId, recipients, subject, body, updatedAt });
  writeAll(drafts);
  return newId;
}

export function deleteDraft(id) {
  if (!id) return;
  const drafts = readAll().filter(d => d.id !== id);
  writeAll(drafts);
}

export function migrateLegacyDraft() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw);
    if (legacy && !isEmpty(legacy)) {
      saveDraft({
        recipients: legacy.recipients || [],
        subject: legacy.subject || '',
        body: legacy.body || ''
      });
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  }
}
