/**
 * CloudFrame — /api/save-analysis
 * 儲存分析結果至 Supabase 資料庫
 *
 * POST /api/save-analysis
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: { projectName, strategy, riskScore, inputs, result, source }
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // 後端使用 service role key，繞過 RLS
);

function cors(origin) {
  const allowed = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || [];
  const allowOrigin = (!allowed.length || allowed.includes(origin)) ? origin : allowed[0] || '*';
  return {
    'Access-Control-Allow-Origin':  allowOrigin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export const handler = async (event) => {
  const corsH = cors(event.headers?.origin || '*');

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsH, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsH, body: '{}' };

  // ── 驗證 JWT ─────────────────────────────────────────────
  const authHeader = event.headers?.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return { statusCode: 401, headers: corsH,
      body: JSON.stringify({ error: '未提供認證 Token' }) };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { statusCode: 401, headers: corsH,
      body: JSON.stringify({ error: '認證失敗，請重新登入' }) };
  }

  // ── 解析 body ─────────────────────────────────────────────
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsH, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const {
    projectName = 'Untitled',
    strategy    = 'replatform',
    riskScore   = 0,
    inputs      = {},
    result      = {},
    source      = 'local',
  } = body;

  // ── 儲存至資料庫 ──────────────────────────────────────────
  const { data, error } = await supabase.from('analyses').insert({
    user_id:      user.id,
    project_name: projectName,
    strategy,
    risk_score:   Math.round(riskScore),
    inputs,
    result,
    source,
  }).select('id, created_at').single();

  if (error) {
    console.error('[save-analysis] DB error:', error);
    return { statusCode: 500, headers: corsH,
      body: JSON.stringify({ error: '儲存失敗：' + error.message }) };
  }

  return {
    statusCode: 200,
    headers: { ...corsH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, id: data.id, created_at: data.created_at }),
  };
};
