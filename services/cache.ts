// Simple in-memory cache for Supabase queries
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milliseconds
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 30000; // 30 seconds default

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Simple pattern matching - supports '*' wildcard
    for (const key of this.cache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.cache.delete(key);
      }
    }
  }

  private matchPattern(key: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(key);
    }
    return key === pattern;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const cache = new SimpleCache();

// Cache keys
export const CACHE_KEYS = {
  memories: (userId: string) => `memories:${userId}`,
  conversations: (userId: string) => `conversations:${userId}`,
  conversation: (userId: string, id: string) => `conversation:${userId}:${id}`,
  user: (userId: string) => `user:${userId}`,
};

