import { PromptGuardado } from '../types';

const DATABASE_NAME = 'system-operator-local';
const STORE_NAME = 'prompts';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento local'));
  });
}

export async function getLocalPrompts(usuarioId: string): Promise<PromptGuardado[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const prompts = (request.result as PromptGuardado[])
        .filter((prompt) => prompt.usuario_id === usuarioId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      resolve(prompts);
    };
    request.onerror = () => reject(request.error || new Error('No se pudieron leer los prompts locales'));
    transaction.oncomplete = () => database.close();
  });
}

export async function saveLocalPrompt(prompt: PromptGuardado): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(prompt);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('No se pudo guardar el prompt localmente'));
    };
  });
}

export async function deleteLocalPrompt(promptId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(promptId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('No se pudo eliminar el prompt local'));
    };
  });
}
