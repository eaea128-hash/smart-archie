/**
 * Smart Archie — /api/config
 * 安全地將前端需要的公開設定值注入頁面
 * （Supabase URL / anon key 是公開的，可安全回傳給前端）
 *
 * GET /api/config
 */

export const handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  // 這些是公開安全的值（anon key 不是 secret key）
  const config = {
    supabaseUrl:      process.env.SUPABASE_URL      || '',
    supabaseAnonKey:  process.env.SUPABASE_ANON_KEY || '',
    sentryDsn:        process.env.SENTRY_DSN          || '',
    mixpanelToken:    process.env.MIXPANEL_TOKEN     || '',
    environment:      process.env.NODE_ENV           || 'development',
  };

  return {
    statusCode: 200,
    headers: {
      ...cors,
      'Content-Type':  'application/json',
      'Cache-Control': 'public, max-age=300', // 5分鐘快取
    },
    body: JSON.stringify(config),
  };
};
