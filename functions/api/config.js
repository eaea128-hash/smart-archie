/**
 * CloudFrame — /api/config
 * 安全地將前端需要的公開設定值注入頁面
 * （Supabase URL / anon key 是公開的，可安全回傳給前端）
 *
 * GET /api/config
 */

// 公開值（anon key 不是 secret key，可以公開）
const SUPABASE_URL      = 'https://oxownfzafrveihxhuxay.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94b3duZnphZnJ2ZWloeGh1eGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTkyMTcsImV4cCI6MjA5MDU5NTIxN30.RZ13Ic5QpxcUmn7GJ9wpxVALvxjdjpm0M7Vp0gb_HX0';

export async function onRequest(context) {
  const { request, env } = context;

  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const config = {
    supabaseUrl:      SUPABASE_URL,
    supabaseAnonKey:  SUPABASE_ANON_KEY,
    sentryDsn:        env.SENTRY_DSN     || '',
    mixpanelToken:    env.MIXPANEL_TOKEN || '',
    environment:      env.NODE_ENV       || 'production',
  };

  return new Response(JSON.stringify(config), {
    status: 200,
    headers: {
      ...cors,
      'Content-Type':  'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
