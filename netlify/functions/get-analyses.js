/**
 * CloudFrame — /api/get-analyses
 * 取得目前用戶的分析歷史
 *
 * GET /api/get-analyses?limit=20&offset=0
 * Headers: Authorization: Bearer <supabase-access-token>
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export const handler = async (event) => {
  const corsH = cors(event.headers?.origin || '*');

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsH, body: '' };
  if (event.httpMethod !== 'GET')    return { statusCode: 405, headers: corsH, body: '{}' };

  const token = (event.headers?.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '未提供 Token' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '認證失敗' }) };

  const params = event.queryStringParameters || {};
  const limit  = Math.min(parseInt(params.limit  || '20', 10), 100);
  const offset = parseInt(params.offset || '0', 10);

  const { data, error, count } = await supabase
    .from('analyses')
    .select('id, project_name, strategy, risk_score, share_token, created_at, inputs, result', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { statusCode: 500, headers: corsH, body: JSON.stringify({ error: error.message }) };

  return {
    statusCode: 200,
    headers: { ...corsH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, analyses: data || [], total: count || 0 }),
  };
};
