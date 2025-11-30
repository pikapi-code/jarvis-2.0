import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../services/supabase-server';
import { userApiKeys, clearUserClientCache } from '../utils/auth';
import { clearUserChatSessions } from './chat';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

/**
 * Simple encryption/decryption for API keys
 * NOTE: This matches the frontend implementation
 */
const encryptApiKey = (apiKey: string): string => {
  return Buffer.from(apiKey).toString('base64');
};

const decryptApiKey = (encrypted: string): string => {
  try {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  } catch (error) {
    throw new Error('Failed to decrypt API key');
  }
};

/**
 * Check if a string looks like a JWT token (has 3 parts separated by dots)
 */
const isJWT = (token: string): boolean => {
  return token.split('.').length === 3;
};

/**
 * Validate a Gemini API key by making a test API call
 * Returns true if valid, throws error if invalid
 */
const validateGeminiApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    // Create a client with the provided key
    const client = new GoogleGenAI({ apiKey });
    
    // Make a simple test call - generate an embedding for a short test string
    // This is lightweight and will fail quickly if the key is invalid
    const response = await client.models.embedContent({
      model: 'text-embedding-004',
      contents: [{ parts: [{ text: 'test' }] }]
    });

    // Check if we got a valid response
    if (!response.embeddings || response.embeddings.length === 0) {
      throw new Error('Invalid API key: No embedding generated');
    }

    return true;
  } catch (error: any) {
    // Parse the error to provide a user-friendly message
    const errorMessage = error.message || 'Unknown error';
    
    // Common Gemini API error patterns
    if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('invalid API key')) {
      throw new Error('Invalid API key. Please check that you copied the key correctly from Google AI Studio.');
    }
    
    if (errorMessage.includes('API_KEY_NOT_FOUND')) {
      throw new Error('API key not found. Please verify your key is correct.');
    }
    
    if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission')) {
      throw new Error('API key does not have the required permissions. Please check your key settings in Google AI Studio.');
    }
    
    if (errorMessage.includes('QUOTA_EXCEEDED') || errorMessage.includes('quota')) {
      throw new Error('API key quota exceeded. Please check your usage limits in Google AI Studio.');
    }
    
    if (errorMessage.includes('UNAUTHENTICATED') || errorMessage.includes('401')) {
      throw new Error('Authentication failed. The API key is invalid or expired.');
    }
    
    // Generic error
    throw new Error(`API key validation failed: ${errorMessage}`);
  }
};

/**
 * Middleware to authenticate user from Supabase session
 */
const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('⚠️ Missing authorization header in API key request');
      // If no Supabase, allow fallback
      if (!supabase) {
        (req as any).userId = 'local-user';
        return next();
      }
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    // Handle development fallback token
    if (token === 'local-user') {
      if (!supabase) {
        console.warn('⚠️ Using fallback authentication (development mode)');
        (req as any).userId = 'local-user';
        return next();
      } else {
        // Supabase is configured, so we need real authentication
        return res.status(401).json({ 
          error: 'Authentication required. Please log in to use this feature.',
          requiresAuth: true
        });
      }
    }

    // If Supabase is not configured, allow any token for development
    if (!supabase) {
      (req as any).userId = 'local-user';
      return next();
    }

    // Only try to verify if it looks like a JWT
    if (!isJWT(token)) {
      console.warn('⚠️ Token does not appear to be a valid JWT format');
      return res.status(401).json({ 
        error: 'Invalid authentication token format.',
        requiresAuth: true
      });
    }

    try {
      console.log('🔍 Attempting to verify token...');
      console.log('🔍 Token preview:', token.substring(0, 20) + '...' + token.substring(token.length - 20));
      
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error) {
        console.error('❌ Authentication error:', error.message);
        console.error('❌ Error code:', error.status);
        console.error('❌ Full error:', JSON.stringify(error, null, 2));
        // If token verification fails, return error (don't fall back to local-user when Supabase is configured)
        return res.status(401).json({ 
          error: `Invalid or expired token: ${error.message}`,
          requiresAuth: true
        });
      }
      
      if (!user) {
        console.error('❌ No user found in token');
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      console.log(`✅ Authenticated user: ${user.id} (${user.email})`);
      (req as any).userId = user.id;
      next();
    } catch (jwtError: any) {
      // Catch JWT parsing errors specifically
      console.error('❌ JWT parsing error:', jwtError.message);
      return res.status(401).json({ 
        error: `Authentication failed: ${jwtError.message || 'Invalid token'}`,
        requiresAuth: true
      });
    }
  } catch (error: any) {
    console.error('❌ Authentication error:', error);
    // Last resort: allow fallback for development
    if (!supabase) {
      (req as any).userId = 'local-user';
      return next();
    }
    res.status(401).json({ error: `Authentication failed: ${error.message}` });
  }
};

// POST /api/api-keys - Save or update user's API key
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { apiKey } = req.body;
    const userId = (req as any).userId;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Basic format validation
    const trimmedKey = apiKey.trim();
    if (trimmedKey.length < 20) {
      return res.status(400).json({ error: 'Invalid API key format. API keys should be at least 20 characters long.' });
    }

    // Validate the API key by making a test call to Gemini API
    try {
      console.log('🔍 Validating API key...');
      await validateGeminiApiKey(trimmedKey);
      console.log('✅ API key validation successful');
    } catch (validationError: any) {
      console.error('❌ API key validation failed:', validationError.message);
      return res.status(400).json({ 
        error: validationError.message || 'Invalid API key. Please check that you copied the key correctly from Google AI Studio.' 
      });
    }

    if (!supabase) {
      // Fallback: store in memory (development only)
      console.warn('⚠️  Supabase not configured - storing API key in memory only (will be lost on server restart)');
      userApiKeys.set(userId, trimmedKey);
      return res.json({ 
        success: true, 
        message: 'API key validated and saved in memory (development mode). Configure Supabase to persist it.',
        warning: 'API key will be lost when server restarts. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env'
      });
    }

    // If Supabase is configured, we need a valid UUID user ID
    // "local-user" is not a valid UUID and cannot be saved to the database
    if (userId === 'local-user') {
      return res.status(401).json({ 
        error: 'Authentication required. Please log in to save your API key.',
        requiresAuth: true
      });
    }

    const encrypted = encryptApiKey(trimmedKey);

    const { error } = await supabase
      .from('user_api_keys')
      .upsert({
        user_id: userId,
        api_key_encrypted: encrypted,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving API key:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return res.status(500).json({ error: `Failed to save API key: ${error.message || 'Unknown error'}` });
    }

    console.log(`✅ API key saved for user: ${userId}`);
    
    // Clear chat sessions and client cache for this user so new API key is used
    clearUserChatSessions(userId);
    clearUserClientCache(userId);
    
    res.json({ success: true, message: 'API key saved successfully' });
  } catch (error: any) {
    console.error('API key save error:', error);
    res.status(500).json({ error: error.message || 'Failed to save API key' });
  }
});

// GET /api/api-keys - Check if user has an API key (without returning it)
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).userId;

    if (!supabase) {
      return res.json({ hasApiKey: userApiKeys.has(userId) });
    }

    // If Supabase is configured, we need a valid UUID user ID
    if (userId === 'local-user') {
      return res.json({ hasApiKey: false });
    }

    const { data, error } = await supabase
      .from('user_api_keys')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.json({ hasApiKey: false });
      }
      throw error;
    }

    res.json({ hasApiKey: !!data });
  } catch (error: any) {
    console.error('API key check error:', error);
    res.status(500).json({ error: error.message || 'Failed to check API key' });
  }
});

// DELETE /api/api-keys - Delete user's API key
router.delete('/', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).userId;

    if (!supabase) {
      userApiKeys.delete(userId);
      return res.json({ success: true, message: 'API key deleted (development mode)' });
    }

    // If Supabase is configured, we need a valid UUID user ID
    if (userId === 'local-user') {
      return res.status(401).json({ 
        error: 'Authentication required. Please log in to delete your API key.',
        requiresAuth: true
      });
    }

    const { error } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting API key:', error);
      return res.status(500).json({ error: 'Failed to delete API key' });
    }

    res.json({ success: true, message: 'API key deleted successfully' });
  } catch (error: any) {
    console.error('API key delete error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete API key' });
  }
});

export { router as apiKeysRouter };

