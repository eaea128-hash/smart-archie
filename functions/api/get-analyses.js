/**
 * CloudFrame — /api/get-analyses
 * 取得目前用戶的分析歷史
 *
 * GET /api/get-analyses?limit=20&offset=0
 * Headers: Authorization: Bearer <supabase-access-token>
 */

import { createClient } from '@supabase/supabase-js';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  const origin = request.headers.get('origin') || '*';
  const corsH  = cors(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (request.method !== 'GET') return new Response('{}', { status: 405, headers: corsH });

  try {
    const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
    if (!token) return new Response(JSON.stringify({ error: '未提供 Token' }), { status: 401, headers: corsH });

    // Initialise Supabase inside handler
    const supabase = createClient('https://oxownfzafrveihxhuxay.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

    // 驗證 token
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authErr || !user) {
      console.error('[get-analyses] Auth error:', authErr?.message);
      return new Response(
        JSON.stringify({ error: '認證失敗', detail: authErr?.message }),
        { status: 401, headers: corsH }
      );
    }

    const url    = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const limit  = Math.min(parseInt(params.limit  || '20', 10), 100);
    const offset = parseInt(params.offset || '0', 10);

    // 先嘗試完整欄位
    let { data, error, count } = await supabase
      .from('analyses')
      .select('id, project_name, strategy, risk_score, share_token, share_enabled, created_at, inputs, result', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 若有欄位不存在，fallback 到基本欄位
    if (error) {
      console.warn('[get-analyses] Full query error, falling back. Code:', error.code, 'Msg:', error.message);
      ({ data, error, count } = await supabase
        .from('analyses')
        .select('id, project_name, strategy, risk_score, created_at', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1));
    }

    if (error) {
      console.error('[get-analyses] DB error:', error);
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: 500, headers: corsH }
      );
    }

    return new Response(
      JSON.stringify({ success: true, analyses: data || [], total: count || 0 }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    console.error('[get-analyses] Unexpected error:', e);
    return new Response(
      JSON.stringify({ error: e.message || 'Unknown error' }),
      { status: 500, headers: corsH }
    );
  }
}
