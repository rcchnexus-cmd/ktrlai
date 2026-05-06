import { createClient } from "@supabase/supabase-js";

const viteEnv = import.meta.env || {};
const supabaseUrl = viteEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY;

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
