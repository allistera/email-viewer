let worker;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/sanitizer.worker.js', import.meta.url), { type: 'module' });

    worker.onmessage = ({ data }) => {
      const { id, html, error } = data;
      const promise = pending.get(id);
      if (promise) {
        if (error) {
          promise.reject(new Error(error));
        } else {
          promise.resolve(html);
        }
        pending.delete(id);
      }
    };

    worker.onerror = (err) => {
      console.error('Sanitizer worker error:', err);
      // Reject all pending promises
      for (const [id, promise] of pending) {
        promise.reject(new Error('Worker error'));
      }
      pending.clear();
      worker.terminate();
      worker = null;
    };
  }
  return worker;
}

export function sanitize(html) {
  if (!html) return Promise.resolve('');

  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    pending.set(id, { resolve, reject });
    try {
      getWorker().postMessage({ id, html });
    } catch (e) {
      pending.delete(id);
      reject(e);
    }
  });
}
