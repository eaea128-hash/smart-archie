/**
 * CloudFrame — /api/send-email
 * 前端呼叫的交易型 Email 入口（需要 Supabase JWT 驗證）
 *
 * POST /api/send-email
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: {
 *   type: 'welcome'   // 目前支援的 email 類型
 * }
 */

import { createClient }      from '@supabase/supabase-js';
import { sendWelcomeEmail }  from './_email.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export const handler = async (event) => {
  const corsH = cors(event.headers?.origin || '*');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsH, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsH, body: JSON.stringify({ error: '僅支援 POST' }) };
  }

  // 驗證 JWT
  const token = (event.headers?.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '未提供 Token' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '認證失敗' }) };

  // 讀取 profile
  const { data: profile } = await supabase
    .from('profiles').select('name, email, plan').eq('id', user.id).single();
  const name  = profile?.name  || user.email?.split('@')[0] || '用戶';
  const email = profile?.email || user.email;

  // 解析 body
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsH, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { type } = body;

  // ── 派發 email 類型 ────────────────────────────────────────
  let result;

  if (type === 'welcome') {
    result = await sendWelcomeEmail({ to: email, name });

  } else {
    return { statusCode: 400, headers: corsH, body: JSON.stringify({ error: `不支援的 email 類型：${type}` }) };
  }

  return {
    statusCode: result.success ? 200 : 500,
    headers: { ...corsH, 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
};
