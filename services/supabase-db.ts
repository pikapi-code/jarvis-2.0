import { supabase } from './supabase';
import { Memory, MemoryType, Conversation, Message } from '../types';
import { cache, CACHE_KEYS } from './cache';

// Check if Supabase is configured and available
const checkSupabaseAvailability = async (): Promise<boolean> => {
  if (!supabase) {
    return false;
  }
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    // If we can get a session (even if null), Supabase is configured
    return true;
  } catch (error) {
    return false;
  }
};

// Cache the availability check
let supabaseAvailable: boolean | null = null;
// Cache user ID to avoid repeated getUser() calls
let cachedUserId: string | null = null;
let userIdCacheTime = 0;
const USER_ID_CACHE_TTL = 60000; // 1 minute

const getCachedUserId = async (): Promise<string | null> => {
  const now = Date.now();
  if (cachedUserId && (now - userIdCacheTime) < USER_ID_CACHE_TTL) {
    return cachedUserId;
  }

  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  cachedUserId = user?.id || null;
  userIdCacheTime = now;
  return cachedUserId;
};

const isSupabaseAvailable = async (): Promise<boolean> => {
  if (supabaseAvailable === null) {
    supabaseAvailable = await checkSupabaseAvailability();
    if (supabaseAvailable) {
      console.log('✅ Using Supabase for data storage');
    } else {
      console.warn('⚠️ Supabase not available, falling back to IndexedDB');
    }
  }
  return supabaseAvailable;
};

// Import IndexedDB functions as fallback
import * as indexedDB from './db';

// Export cache invalidation helper
export const invalidateCache = (pattern?: string) => {
  cache.invalidate(pattern);
};

/**
 * Add a memory to the database
 */
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
  if (await isSupabaseAvailable() && supabase) {
    const userId = await getCachedUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('memories')
      .insert({
        user_id: userId,
        content,
        category,
        tags,
        type,
        media_data: mediaData || null,
        media_mime_type: mediaMimeType || null,
        media_name: mediaName || null,
        embedding: embedding || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Invalidate cache
    cache.invalidate(CACHE_KEYS.memories(userId));

    return data.id;
  } else {
    // Fallback to IndexedDB
    return indexedDB.addMemory(content, category, tags, type, mediaData, mediaMimeType, mediaName, embedding);
  }
};

/**
 * Get all memories for the current user (with caching)
 */
export const getAllMemories = async (useCache: boolean = true): Promise<Memory[]> => {
  if (await isSupabaseAvailable() && supabase) {
    const userId = await getCachedUserId();
    if (!userId) {
      return [];
    }

    const cacheKey = CACHE_KEYS.memories(userId);
    
    // Check cache first
    if (useCache) {
      const cached = cache.get<Memory[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Optimize query - exclude heavy fields unless needed
    const { data, error } = await supabase
      .from('memories')
      .select('id, content, category, tags, type, media_mime_type, media_name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return [];
    }

    // Convert Supabase format to Memory format
    const memories = (data || []).map((m: any) => ({
      id: m.id,
      content: m.content,
      category: m.category,
      tags: m.tags || [],
      timestamp: new Date(m.created_at).getTime(),
      type: m.type as MemoryType,
      mediaMimeType: m.media_mime_type || undefined,
      mediaName: m.media_name || undefined,
      // Don't load heavy fields by default
      mediaData: undefined,
      embedding: undefined,
    }));

    // Cache for 30 seconds
    cache.set(cacheKey, memories, 30000);
    return memories;
  } else {
    // Fallback to IndexedDB
    return indexedDB.getAllMemories();
  }
};

/**
 * Search memories by keyword
 */
export const searchMemories = async (query: string): Promise<Memory[]> => {
  if (await isSupabaseAvailable() && supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('searchMemories: User not authenticated');
      return [];
    }

    const searchPattern = `%${query.toLowerCase()}%`;
    const queryLower = query.toLowerCase();

    // Search in content, category, and tags separately, then combine
    // This is more reliable than .or() syntax which can be finicky
    const [contentResults, categoryResults, tagResults] = await Promise.all([
      supabase
        .from('memories')
        .select('*')
        .eq('user_id', user.id)
        .ilike('content', searchPattern)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('memories')
        .select('*')
        .eq('user_id', user.id)
        .ilike('category', searchPattern)
        .order('created_at', { ascending: false })
        .limit(50),
      // Search in tags array - get all memories and filter in JS since Supabase array search is limited
      supabase
        .from('memories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100) // Get more to filter by tags
    ]);

    // Filter tag results in JavaScript (Supabase array search is limited)
    let filteredTagResults: any[] = [];
    if (tagResults.data) {
      filteredTagResults = tagResults.data.filter((m: any) => {
        const tags = (m.tags || []).map((t: string) => t.toLowerCase());
        return tags.some((tag: string) => tag.includes(queryLower));
      });
    }

    // Combine results and deduplicate by id
    const allResults = new Map<number, any>();
    
    if (contentResults.data) {
      contentResults.data.forEach((m: any) => allResults.set(m.id, m));
    }
    if (categoryResults.data) {
      categoryResults.data.forEach((m: any) => {
        if (!allResults.has(m.id)) {
          allResults.set(m.id, m);
        }
      });
    }
    // Add tag matches
    filteredTagResults.forEach((m: any) => {
      if (!allResults.has(m.id)) {
        allResults.set(m.id, m);
      }
    });

    if (contentResults.error) {
      console.error('Supabase content search error:', contentResults.error);
    }
    if (categoryResults.error) {
      console.error('Supabase category search error:', categoryResults.error);
    }
    if (tagResults.error) {
      console.error('Supabase tag search error:', tagResults.error);
    }

    // Convert to array and sort by created_at
    const results = Array.from(allResults.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    return results.map((m: any) => ({
      id: m.id,
      content: m.content,
      category: m.category,
      tags: m.tags || [],
      timestamp: new Date(m.created_at).getTime(),
      type: m.type as MemoryType,
      mediaData: m.media_data || undefined,
      mediaMimeType: m.media_mime_type || undefined,
      mediaName: m.media_name || undefined,
      embedding: m.embedding || undefined,
    }));
  } else {
    // Fallback to IndexedDB
    return indexedDB.searchMemories(query);
  }
};

/**
 * Vector search memories using embeddings
 */
export const vectorSearchMemories = async (queryEmbedding: number[]): Promise<Memory[]> => {
  if (await isSupabaseAvailable() && supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('vectorSearchMemories: User not authenticated');
      return [];
    }

    if (!queryEmbedding || queryEmbedding.length === 0) {
      console.warn('vectorSearchMemories: Empty embedding provided');
      return [];
    }

    // Use Supabase's vector similarity search
    // Note: This requires the pgvector extension and proper setup
    // Lower threshold (0.5) for better recall - we'll filter/rank results
    const { data, error } = await supabase.rpc('match_memories', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5, // Lowered from 0.7 for better recall
      match_count: 15, // Increased from 10
      user_id_param: user.id
    });

    if (error) {
      console.error('Supabase vector search error:', error);
      // Don't return empty - let keyword search handle it
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((m: any) => ({
      id: m.id,
      content: m.content,
      category: m.category,
      tags: m.tags || [],
      timestamp: new Date(m.created_at).getTime(),
      type: m.type as MemoryType,
      mediaData: m.media_data || undefined,
      mediaMimeType: m.media_mime_type || undefined,
      mediaName: m.media_name || undefined,
      embedding: m.embedding || undefined,
    }));
  } else {
    // Fallback to IndexedDB
    return indexedDB.vectorSearchMemories(queryEmbedding);
  }
};

/**
 * Delete a memory
 */
export const deleteMemory = async (id: number): Promise<void> => {
  if (await isSupabaseAvailable() && supabase) {
    const userId = await getCachedUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Invalidate cache
    cache.invalidate(CACHE_KEYS.memories(userId));
  } else {
    // Fallback to IndexedDB
    return indexedDB.deleteMemory(id);
  }
};

/**
 * Save a conversation
 */
export const saveConversation = async (conversation: Conversation): Promise<void> => {
  if (await isSupabaseAvailable() && supabase) {
    const userId = await getCachedUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('conversations')
      .upsert({
        id: conversation.id,
        user_id: userId,
        title: conversation.title,
        messages: conversation.messages,
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Invalidate cache
    cache.invalidate(CACHE_KEYS.conversations(userId));
    cache.invalidate(CACHE_KEYS.conversation(userId, conversation.id));
  } else {
    // Fallback to IndexedDB
    return indexedDB.saveConversation(conversation);
  }
};

/**
 * Get all conversations for the current user (with caching)
 */
export const getConversations = async (useCache: boolean = true): Promise<Conversation[]> => {
  if (await isSupabaseAvailable() && supabase) {
    const userId = await getCachedUserId();
    if (!userId) {
      return [];
    }

    const cacheKey = CACHE_KEYS.conversations(userId);
    
    // Check cache first
    if (useCache) {
      const cached = cache.get<Conversation[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Optimize query - only get metadata, not full messages
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return [];
    }

    const conversations = (data || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      messages: [], // Don't load messages in list view
      timestamp: new Date(c.created_at).getTime(),
    }));

    // Cache for 30 seconds
    cache.set(cacheKey, conversations, 30000);
    return conversations;
  } else {
    // Fallback to IndexedDB
    return indexedDB.getConversations();
  }
};

/**
 * Get a specific conversation (with caching)
 */
export const getConversation = async (id: string, useCache: boolean = true): Promise<Conversation | null> => {
  if (await isSupabaseAvailable() && supabase) {
    const userId = await getCachedUserId();
    if (!userId) {
      return null;
    }

    const cacheKey = CACHE_KEYS.conversation(userId, id);
    
    // Check cache first
    if (useCache) {
      const cached = cache.get<Conversation>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Supabase error:', error);
      return null;
    }

    const conversation = {
      id: data.id,
      title: data.title,
      messages: data.messages || [],
      timestamp: new Date(data.created_at).getTime(),
    };

    // Cache for 5 minutes (conversations change less frequently)
    cache.set(cacheKey, conversation, 300000);
    return conversation;
  } else {
    // Fallback to IndexedDB
    return indexedDB.getConversation(id);
  }
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (id: string): Promise<void> => {
  if (await isSupabaseAvailable() && supabase) {
    const userId = await getCachedUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Invalidate cache
    cache.invalidate(CACHE_KEYS.conversations(userId));
    cache.invalidate(CACHE_KEYS.conversation(userId, id));
  } else {
    // Fallback to IndexedDB
    return indexedDB.deleteConversation(id);
  }
};

/**
 * Simple encryption/decryption for API keys
 * NOTE: This is a basic implementation. In production, use proper encryption libraries.
 */
const encryptApiKey = (apiKey: string): string => {
  // Simple base64 encoding (not truly secure, but better than plaintext)
  // In production, use proper encryption like AES-256-GCM
  return btoa(apiKey);
};

const decryptApiKey = (encrypted: string): string => {
  try {
    return atob(encrypted);
  } catch (error) {
    throw new Error('Failed to decrypt API key');
  }
};

/**
 * Save or update user's API key
 */
export const saveUserApiKey = async (apiKey: string): Promise<void> => {
  if (await isSupabaseAvailable() && supabase) {
    const userId = await getCachedUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const encrypted = encryptApiKey(apiKey);

    // Try to update first, if no rows affected, insert
    const { error: updateError } = await supabase
      .from('user_api_keys')
      .upsert({
        user_id: userId,
        api_key_encrypted: encrypted,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('Supabase error saving API key:', updateError);
      throw updateError;
    }
  } else {
    // Fallback to localStorage for development
    localStorage.setItem('jarvis-api-key', apiKey);
  }
};

/**
 * Get user's API key (decrypted)
 */
export const getUserApiKey = async (): Promise<string | null> => {
  if (await isSupabaseAvailable() && supabase) {
    const userId = await getCachedUserId();
    if (!userId) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_api_keys')
      .select('api_key_encrypted')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No API key found
        return null;
      }
      console.error('Supabase error getting API key:', error);
      return null;
    }

    if (!data || !data.api_key_encrypted) {
      return null;
    }

    try {
      return decryptApiKey(data.api_key_encrypted);
    } catch (error) {
      console.error('Error decrypting API key:', error);
      return null;
    }
  } else {
    // Fallback to localStorage for development
    return localStorage.getItem('jarvis-api-key');
  }
};

/**
 * Delete user's API key
 */
export const deleteUserApiKey = async (): Promise<void> => {
  if (await isSupabaseAvailable() && supabase) {
    const userId = await getCachedUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase error deleting API key:', error);
      throw error;
    }
  } else {
    // Fallback to localStorage for development
    localStorage.removeItem('jarvis-api-key');
  }
};

