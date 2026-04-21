/**
 * Smart Archie — Supabase Client
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

  // ── Config ─────────────────────────────────────────────────
  // 這兩個值從 window.__SA_CONFIG__ 注入（由 netlify/functions/config.js 提供）
  // 若找不到則使用預設佔位（開發時直接填入）
  const config = global.__SA_CONFIG__ || {};

  const SUPABASE_URL     = config.supabaseUrl     || '';
  const SUPABASE_ANON_KEY = config.supabaseAnonKey || '';

  // ── Check if Supabase SDK is loaded ────────────────────────
  function isSupabaseLoaded() {
    return typeof global.supabase !== 'undefined' &&
           typeof global.supabase.createClient === 'function';
  }

  // ── Create client ───────────────────────────────────────────
  let _client = null;

  function getClient() {
    if (_client) return _client;
    if (!isSupabaseLoaded()) {
      console.warn('[SupabaseClient] Supabase SDK not loaded');
      return null;
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('[SupabaseClient] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return null;
    }
    _client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken:   true,
        persistSession:     true,
        detectSessionInUrl: true,
        storage:            localStorage,
      },
    });
    return _client;
  }

  function isConfigured() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY && isSupabaseLoaded());
  }

  // ── Public API ──────────────────────────────────────────────
  global.SupabaseClient = { getClient, isConfigured };

})(typeof window !== 'undefined' ? window : globalThis);
