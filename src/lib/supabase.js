import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gpzsgcosjkkrzxheubqd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'PEGA_AQUI_TU_SUPABASE_PUBLISHABLE_KEY' &&
  !supabaseAnonKey.includes('PEGA_AQUI')
);

// Fallback dummy key to prevent immediate client crash before user sets valid key
const safeAnonKey = isSupabaseConfigured 
  ? supabaseAnonKey 
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

export const supabase = createClient(supabaseUrl, safeAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
