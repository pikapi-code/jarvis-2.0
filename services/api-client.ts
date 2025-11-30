import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Get authorization headers for API requests
 * Optionally accepts a session to avoid re-fetching
 */
export async function getAuthHeaders(session?: any): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (supabase) {
    try {
      let currentSession = session;
      
      // If no session provided, get it from Supabase
      if (!currentSession) {
        const { data: { session: fetchedSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          throw new Error(`Failed to get session: ${error.message}`);
        }

        if (!fetchedSession) {
          console.warn('⚠️ No active session found');
          throw new Error('No active session. Please log in again.');
        }

        currentSession = fetchedSession;
      }

      // Verify we have an access token
      if (!currentSession?.access_token) {
        console.error('❌ Session exists but no access_token found');
        throw new Error('Session missing access token. Please log in again.');
      }

      // Verify token format (JWT should have 3 parts)
      const tokenParts = currentSession.access_token.split('.');
      if (tokenParts.length !== 3) {
        console.error('❌ Invalid JWT token format:', {
          tokenLength: currentSession.access_token.length,
          parts: tokenParts.length,
          tokenPreview: currentSession.access_token.substring(0, 20) + '...'
        });
        throw new Error('Invalid token format. Please log in again.');
      }

      // Try to refresh the session to ensure it's valid
      try {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshedSession) {
          currentSession = refreshedSession;
          console.log('✅ Session refreshed successfully');
        } else if (refreshError) {
          // If refresh fails, log but continue with existing session
          // The server will validate it
          console.warn('⚠️ Could not refresh session:', refreshError.message);
        }
      } catch (refreshErr: any) {
        console.warn('⚠️ Session refresh attempt failed:', refreshErr?.message || refreshErr);
        // Continue with existing session - server will validate it
      }

      headers['Authorization'] = `Bearer ${currentSession.access_token}`;
      console.log('✅ Using authenticated session token for user:', currentSession.user?.email || currentSession.user?.id);
      
    } catch (error: any) {
      console.error('❌ Failed to get auth token:', error);
      // Re-throw the error so the caller knows what went wrong
      throw error;
    }
  } else {
    // Development fallback - use a dummy token only if Supabase is not configured
    console.warn('⚠️ Supabase not configured, using development fallback');
    headers['Authorization'] = 'Bearer local-user';
  }

  return headers;
}

/**
 * Check if the user has configured an API key
 */
export async function hasApiKey(): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/api-keys`, {
      method: 'GET',
      headers,
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.hasApiKey || false;
    }
    return false;
  } catch (error) {
    console.error('Failed to check API key:', error);
    return false;
  }
}

