/**
 * Task Storage Adapter - Routes to correct storage backend
 * Detects environment (browser vs Node.js) and uses appropriate store
 */

const IS_NODE = typeof window === 'undefined' && typeof process !== 'undefined';

let storageBackend: any = null;

async function getBackend() {
  if (storageBackend) return storageBackend;

  if (IS_NODE) {
    // Node.js environment - use file-based store
    const { nodeTaskStore } = await import('./nodeTaskStore');
    storageBackend = nodeTaskStore;
  } else {
    // Browser environment - use IndexedDB
    const { openDB } = await import('idb');
    storageBackend = await openDB('neuro_tasks', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }
      },
    });
  }

  return storageBackend;
}

export async function getTask(id: string) {
  const backend = await getBackend();
  if (IS_NODE) {
    return backend.get(id);
  }
  return backend.get('tasks', id);
}

export async function putTask(task: any) {
  const backend = await getBackend();
  if (IS_NODE) {
    return backend.put(task);
  }
  return backend.put('tasks', task);
}

export async function deleteTask(id: string) {
  const backend = await getBackend();
  if (IS_NODE) {
    return backend.delete(id);
  }
  return backend.delete('tasks', id);
}

export async function getAllTasks() {
  const backend = await getBackend();
  if (IS_NODE) {
    return backend.getAll();
  }
  return backend.getAll('tasks');
}

export async function updateTask(id: string, updates: any) {
  const task = await getTask(id);
  if (!task) return;
  const updated = { ...task, ...updates };
  await putTask(updated);
}
