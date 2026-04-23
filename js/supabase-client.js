/**
 * CloudFrame — Supabase Client
 * 初始化 Supabase 並匯出給所有頁面使用
 *
 * 環境變數（Netlify）：
 *   SUPABASE_URL        → 你的 Supabase Project URL
 *   SUPABASE_ANON_KEY   → 你的 Supabase anon/public key
 *
 * 前端直接讀取（透過 meta tag 注入，見 netlify/functions/config.js）
 * 或直接在此設定（僅限 anon key，安全的）
 */

(function(global) {
  'use strict';

  // ── Check if Supabase SDK is loaded ────────────────────────
  function isSupabaseLoaded() {
    return typeof global.supabase !== 'undefined' &&
           typeof global.supabase.createClient === 'function';
  }

  // ── Create client ───────────────────────────────────────────
  // 注意：每次 getClient() 都重新讀取 __SA_CONFIG__
  // 因為 /api/config 是非同步載入，初始化時可能還是空的
  let _client = null;

  function getClient() {
    if (_client) return _client;
    if (!isSupabaseLoaded()) {
      console.warn('[SupabaseClient] Supabase SDK not loaded');
      return null;
    }

    // 動態讀取，確保拿到最新的設定（/api/config 回來後才有值）
    const cfg = global.__SA_CONFIG__ || {};
    const url = cfg.supabaseUrl     || '';
    const key = cfg.supabaseAnonKey || '';

    if (!url || !key) {
      console.warn('[SupabaseClient] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return null;
    }

    _client = global.supabase.createClient(url, key, {
      auth: {
        autoRefreshToken:   true,
        persistSession:     true,
        detectSessionInUrl: true,
        storage:            localStorage,
      },
    });
    return _client;
  }

  // 強制重新初始化（config 載入後呼叫）
  function reinit() {
    _client = null;
    return getClient();
  }

  function isConfigured() {
    const cfg = global.__SA_CONFIG__ || {};
    return !!(cfg.supabaseUrl && cfg.supabaseAnonKey && isSupabaseLoaded());
  }

  // ── Public API ──────────────────────────────────────────────
  global.SupabaseClient = { getClient, isConfigured };

})(typeof window !== 'undefined' ? window : globalThis);
