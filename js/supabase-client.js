import { CONFIG } from "./config.js";

let client = null;

export class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigurationError";
    this.code = "SUPABASE_NOT_CONFIGURED";
  }
}

export function isSupabaseConfigured() {
  return CONFIG.supabase.configured;
}

export function getSupabaseClient() {
  if (client) return client;
  if (!isSupabaseConfigured()) {
    throw new ConfigurationError(
      "Die Supabase-DEV-Verbindung ist noch nicht konfiguriert."
    );
  }
  if (!window.supabase?.createClient) {
    throw new ConfigurationError(
      "Die Supabase-JavaScript-Bibliothek konnte nicht geladen werden."
    );
  }

  client = window.supabase.createClient(
    CONFIG.supabase.url,
    CONFIG.supabase.publishableKey,
    {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true
      }
    }
  );

  return client;
}
