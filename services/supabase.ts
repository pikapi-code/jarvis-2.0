import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not found. Using IndexedDB fallback.');
}

// Create Supabase client
export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

// Database types (matching our schema)
export interface Database {
  public: {
    Tables: {
      memories: {
        Row: {
          id: number;
          user_id: string;
          content: string;
          category: string;
          tags: string[];
          type: 'text' | 'image' | 'audio' | 'file';
          media_data: string | null;
          media_mime_type: string | null;
          media_name: string | null;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          content: string;
          category: string;
          tags: string[];
          type?: 'text' | 'image' | 'audio' | 'file';
          media_data?: string | null;
          media_mime_type?: string | null;
          media_name?: string | null;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          content?: string;
          category?: string;
          tags?: string[];
          type?: 'text' | 'image' | 'audio' | 'file';
          media_data?: string | null;
          media_mime_type?: string | null;
          media_name?: string | null;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          messages: any; // JSONB
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          messages: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          messages?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

