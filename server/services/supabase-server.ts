import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase configuration for server-side
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Create Supabase client for server-side operations
// Use service role key if available (bypasses RLS), otherwise use anon key
export const supabase: SupabaseClient | null = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Log Supabase configuration status
if (!supabase) {
  console.warn('⚠️  Supabase not configured on server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env');
  console.warn('   API keys will be stored in memory only (development mode)');
} else {
  console.log('✅ Supabase configured on server');
}

