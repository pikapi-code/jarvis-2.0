import { Memory, MemoryType } from '../types';

const DB_NAME = 'JarvisDB';
const DB_VERSION = 3; // Bump version for schema changes
const MEMORY_STORE = 'memories';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MEMORY_STORE)) {
        const objectStore = db.createObjectStore(MEMORY_STORE, { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('category', 'category', { unique: false });
        objectStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        objectStore.createIndex('content', 'content', { unique: false });
        objectStore.createIndex('type', 'type', { unique: false });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      } else {
        // Upgrade existing store if needed
        const objectStore = (event.target as IDBOpenDBRequest).transaction?.objectStore(MEMORY_STORE);
        if (objectStore) {
          if (!objectStore.indexNames.contains('type')) objectStore.createIndex('type', 'type', { unique: false });
          if (!objectStore.indexNames.contains('timestamp')) objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      }

      if (!db.objectStoreNames.contains('conversations')) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
};

export const addMemory = async (
  content: string,
  category: string = 'general',
  tags: string[] = [],
  type: MemoryType = 'text',
  mediaData?: string,
  mediaMimeType?: string,
  mediaName?: string,
  embedding?: number[]
): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MEMORY_STORE], 'readwrite');
    const store = transaction.objectStore(MEMORY_STORE);
    const memory: Omit<Memory, 'id'> = {
      content,
      category,
      tags,
      timestamp: Date.now(),
      type,
      mediaData,
      mediaMimeType,
      mediaName,
      embedding
    };
    const request = store.add(memory);

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
};

const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
};

export const vectorSearchMemories = async (queryEmbedding: number[], limit: number = 5): Promise<Memory[]> => {
  const memories = await getAllMemories();
  const scored = memories
    .filter(m => m.embedding)
    .map(m => ({ memory: m, score: cosineSimilarity(queryEmbedding, m.embedding!) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(item => item.memory);
};

export const searchMemories = async (query: string): Promise<Memory[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MEMORY_STORE], 'readonly');
    const store = transaction.objectStore(MEMORY_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const allMemories = request.result as Memory[];
      const lowerQuery = query.toLowerCase();

      // Split query into keywords, ignoring common stop words if possible, but for now just split by space
      const keywords = lowerQuery.split(/\s+/).filter(k => k.length > 2); // Only consider words > 2 chars

      const filtered = allMemories.filter(mem => {
        const content = mem.content.toLowerCase();
        const category = mem.category.toLowerCase();
        const tags = mem.tags.map(t => t.toLowerCase());
        const mediaName = mem.mediaName ? mem.mediaName.toLowerCase() : '';

        // If no valid keywords, fall back to exact substring match of the whole query
        if (keywords.length === 0) {
          return content.includes(lowerQuery) ||
            category.includes(lowerQuery) ||
            tags.some(t => t.includes(lowerQuery));
        }

        // Match if ANY keyword is present (OR logic) - better for recall
        return keywords.some(keyword =>
          content.includes(keyword) ||
          category.includes(keyword) ||
          tags.some(t => t.includes(keyword)) ||
          mediaName.includes(keyword)
        );
      });

      // Simple scoring: prioritize memories that match MORE keywords
      const scored = filtered.map(mem => {
        let score = 0;
        const content = mem.content.toLowerCase();
        keywords.forEach(k => {
          if (content.includes(k)) score += 1;
          if (mem.category.toLowerCase().includes(k)) score += 1;
          if (mem.tags.some(t => t.toLowerCase().includes(k))) score += 1;
        });
        return { mem, score };
      });

      // Sort by score desc, then timestamp desc
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.mem.timestamp - a.mem.timestamp;
      });

      resolve(scored.map(s => s.mem));
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAllMemories = async (): Promise<Memory[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MEMORY_STORE], 'readonly');
    const store = transaction.objectStore(MEMORY_STORE);
    // Use index to sort by timestamp descending would be better, but getAll is simple
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as Memory[];
      resolve(results.sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteMemory = async (id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MEMORY_STORE], 'readwrite');
    const store = transaction.objectStore(MEMORY_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// New helpers for specific views
export const getMemoriesByType = async (type: MemoryType): Promise<Memory[]> => {
  const memories = await getAllMemories();
  return memories.filter(m => m.type === type);
};

export const getMemoriesByCategory = async (category: string): Promise<Memory[]> => {
  const memories = await getAllMemories();
  return memories.filter(m => m.category.toLowerCase() === category.toLowerCase());
};

// Conversation Helpers
import { Conversation } from '../types';

export const saveConversation = async (conversation: Conversation): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['conversations'], 'readwrite');
    const store = transaction.objectStore('conversations');
    const request = store.put(conversation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getConversations = async (): Promise<Conversation[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['conversations'], 'readonly');
    const store = transaction.objectStore('conversations');
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as Conversation[];
      resolve(results.sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => reject(request.error);
  });
};

export const getConversation = async (id: string): Promise<Conversation | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['conversations'], 'readonly');
    const store = transaction.objectStore('conversations');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as Conversation);
    request.onerror = () => reject(request.error);
  });
};

export const deleteConversation = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['conversations'], 'readwrite');
    const store = transaction.objectStore('conversations');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
