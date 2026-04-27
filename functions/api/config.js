/**
 * CloudFrame — /api/config
 * 安全地將前端需要的公開設定值注入頁面
 * （Supabase URL / anon key 是公開的，可安全回傳給前端）
 *
 * GET /api/config
 */

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

  // 這些是公開安全的值（anon key 不是 secret key）
  const config = {
    supabaseUrl:      env.SUPABASE_URL      || '',
    supabaseAnonKey:  env.SUPABASE_ANON_KEY || '',
    sentryDsn:        env.SENTRY_DSN        || '',
    mixpanelToken:    env.MIXPANEL_TOKEN    || '',
    environment:      env.NODE_ENV          || 'development',
  };

  return new Response(JSON.stringify(config), {
    status: 200,
    headers: {
      ...cors,
      'Content-Type':  'application/json',
      'Cache-Control': 'public, max-age=300', // 5分鐘快取
    },
  });
}
