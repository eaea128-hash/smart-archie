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

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  const origin = request.headers.get('origin') || '*';
  const corsH  = cors(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '僅支援 POST' }), { status: 405, headers: corsH });
  }

  // Initialise Supabase inside handler
  const supabase = createClient('https://oxownfzafrveihxhuxay.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

  // 驗證 JWT
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return new Response(JSON.stringify({ error: '未提供 Token' }), { status: 401, headers: corsH });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: '認證失敗' }), { status: 401, headers: corsH });
  }

  // 讀取 profile
  const { data: profile } = await supabase
    .from('profiles').select('name, email, plan').eq('id', user.id).maybeSingle();
  const name  = profile?.name  || user.email?.split('@')[0] || '用戶';
  const email = profile?.email || user.email;

  // 解析 body
  let body;
  try { body = await request.json().catch(() => ({})); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsH }); }

  const { type } = body;

  // ── 派發 email 類型 ────────────────────────────────────────
  let result;

  if (type === 'welcome') {
    result = await sendWelcomeEmail({ to: email, name }, env);

  } else {
    return new Response(
      JSON.stringify({ error: `不支援的 email 類型：${type}` }),
      { status: 400, headers: corsH }
    );
  }

  return new Response(
    JSON.stringify(result),
    { status: result.success ? 200 : 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
  );
}
