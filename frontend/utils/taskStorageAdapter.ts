/**
 * Task Storage Adapter - IndexedDB-based storage
 * Browser-only implementation (Node.js backend removed)
 */

let storageBackend: any = null;

async function getBackend() {
  if (storageBackend) return storageBackend;

  // Browser environment - use IndexedDB
  const { openDB } = await import('idb');
  storageBackend = await openDB('neuro_tasks', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' });
      }
    },
  });

  return storageBackend;
}

export async function getTask(id: string) {
  const backend = await getBackend();
  return backend.get('tasks', id);
}

export async function putTask(task: any) {
  const backend = await getBackend();
  return backend.put('tasks', task);
}

export async function deleteTask(id: string) {
  const backend = await getBackend();
  return backend.delete('tasks', id);
}

export async function getAllTasks() {
  const backend = await getBackend();
  return backend.getAll('tasks');
}

export async function updateTask(id: string, updates: any) {
  const task = await getTask(id);
  if (!task) return;
  const updated = { ...task, ...updates };
  await putTask(updated);
}
