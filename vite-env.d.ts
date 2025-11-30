/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // Add other Vite env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

