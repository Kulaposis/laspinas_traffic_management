// Supabase Configuration
import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate credentials before creating client
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file';

  throw new Error(errorMsg);
}

// Create Supabase client with valid credentials
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We're using backend auth, not Supabase auth
    autoRefreshToken: false
  }
});

export default supabase;

