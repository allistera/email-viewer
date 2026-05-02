const STORAGE_KEY = 'emailSignature';

export function getEmailSignature() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setEmailSignature(html) {
  try {
    localStorage.setItem(STORAGE_KEY, html || '');
  } catch { /* ignore quota errors */ }
}

export function clearEmailSignature() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
