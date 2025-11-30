import { Request, Response, NextFunction } from 'express';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../services/supabase-server';
import dotenv from 'dotenv';

dotenv.config();

// Cache for user API keys (in-memory, for development fallback)
const userApiKeys = new Map<string, string>();

// Cache for Gemini clients per user
const userClients = new Map<string, GoogleGenAI>();

// Export function to clear client cache for a user (when API key changes)
export function clearUserClientCache(userId: string) {
  userClients.delete(userId);
  console.log(`🗑️  Cleared Gemini client cache for user: ${userId}`);
}

/**
 * Decrypt API key (matches frontend encryption)
 */
const decryptApiKey = (encrypted: string): string => {
  try {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  } catch (error) {
    throw new Error('Failed to decrypt API key');
  }
};

/**
 * Get user's API key from database or fallback
 */
export async function getUserApiKey(userId: string): Promise<string | null> {
  // Development fallback
  if (userApiKeys.has(userId)) {
    return userApiKeys.get(userId)!;
  }

  if (!supabase) {
    // Fallback to server-wide key if no Supabase
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
  }

  try {
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('api_key_encrypted')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return decryptApiKey(data.api_key_encrypted);
  } catch (error) {
    console.error('Error getting user API key:', error);
    return null;
  }
}

/**
 * Get or create Gemini client for a user
 */
export async function getGeminiClientForUser(userId: string | null): Promise<GoogleGenAI> {
  // If no userId, use server-wide key (fallback)
  if (!userId) {
    const serverKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!serverKey) {
      throw new Error('No API key available. Please configure GEMINI_API_KEY or provide your own API key in settings.');
    }
    if (!userClients.has('server')) {
      userClients.set('server', new GoogleGenAI({ apiKey: serverKey }));
    }
    return userClients.get('server')!;
  }

  // Check cache first
  if (userClients.has(userId)) {
    return userClients.get(userId)!;
  }

  // Get user's API key
  const apiKey = await getUserApiKey(userId);
  
  if (!apiKey) {
    throw new Error('No API key configured. Please add your Gemini API key in Settings.');
  }

  // Create and cache client
  const client = new GoogleGenAI({ apiKey });
  userClients.set(userId, client);
  return client;
}

/**
 * Middleware to authenticate user and attach userId to request
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (supabase) {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          userId = user.id;
        }
      } else {
        // Development fallback - accept any token or use 'local-user'
        userId = 'local-user';
      }
    }

    // Attach userId to request (null if not authenticated, which will use server key)
    (req as any).userId = userId;
    next();
  } catch (error) {
    // Continue without authentication (will use server key as fallback)
    (req as any).userId = null;
    next();
  }
}

// Export for API keys route to use
export { userApiKeys };

