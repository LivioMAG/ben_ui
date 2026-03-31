let supabaseClient = null;
let configCache = null;

export async function loadSupabaseConfig() {
  if (configCache) return configCache;
  const res = await fetch('config/supabase.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Supabase-Konfiguration konnte nicht geladen werden.');
  configCache = await res.json();
  if (!configCache.supabaseUrl || !configCache.supabaseAnonKey) {
    throw new Error('Supabase URL oder Public Key fehlen in config/supabase.json.');
  }
  return configCache;
}

export async function initSupabase() {
  if (supabaseClient) return supabaseClient;
  const cfg = await loadSupabaseConfig();
  if (!window.supabase) throw new Error('Supabase SDK nicht geladen.');
  supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  return supabaseClient;
}

export async function getSupabase() {
  return initSupabase();
}
