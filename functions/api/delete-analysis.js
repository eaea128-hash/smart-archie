/**
 * CloudFrame — /api/delete-analysis
 * 刪除單筆分析記錄（service_role 繞過 RLS，並驗證擁有者）
 *
 * DELETE /api/delete-analysis
 * Headers: Authorization: Bearer <access-token>
 * Body:    { id: "<uuid>" }
 */

import { createClient } from '@supabase/supabase-js';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '*';
  const corsH  = cors(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: '僅支援 DELETE 方法' }), { status: 405, headers: corsH });
  }

  // ── 驗證 Token ──
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return new Response(JSON.stringify({ error: '未提供 Token' }), { status: 401, headers: corsH });

  const supabase = createClient('https://oxownfzafrveihxhuxay.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return new Response(JSON.stringify({ error: '認證失敗' }), { status: 401, headers: corsH });

  // ── 解析 body ──
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const { id } = body || {};
  if (!id) return new Response(JSON.stringify({ error: '缺少 id 參數' }), { status: 400, headers: corsH });

  // ── 確認擁有者 ──
  const { data: record } = await supabase
    .from('analyses').select('id, user_id').eq('id', id).maybeSingle();

  if (!record) return new Response(JSON.stringify({ error: '找不到記錄' }), { status: 404, headers: corsH });
  if (record.user_id !== user.id) return new Response(JSON.stringify({ error: '無權刪除此記錄' }), { status: 403, headers: corsH });

  // ── 刪除 ──
  const { error: delErr } = await supabase
    .from('analyses').delete().eq('id', id).eq('user_id', user.id);

  if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: corsH });

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsH, 'Content-Type': 'application/json' },
  });
}
