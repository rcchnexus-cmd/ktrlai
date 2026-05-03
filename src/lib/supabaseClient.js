import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Phase 1 foundation:
// The current app still reads from src/api/mockApi.js so the UI remains usable
// without Supabase credentials. When both public env vars are present, this
// client is ready for replacing individual mock API methods with real queries.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Never place a service role key in frontend code. Vite exposes VITE_* values
// to the browser, so this client must only use the public anon key.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export async function getSupabaseAccessToken() {
  if (!supabase) {
    return "";
  }

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}
