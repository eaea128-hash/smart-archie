/**
 * CloudFrame — /api/admin-data
 * 管理員專用：取得完整用戶統計與分析數據
 *
 * GET /api/admin-data?type=overview|users|analyses
 * Headers: Authorization: Bearer <supabase-access-token>
 */

import { createClient } from '@supabase/supabase-js';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  const origin = request.headers.get('origin') || '*';
  const corsH  = cors(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });

  // Initialise Supabase inside handler
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // ── 驗證並確認是管理員 ────────────────────────────────────
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return new Response(JSON.stringify({ error: '未提供 Token' }), { status: 401, headers: corsH });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return new Response(JSON.stringify({ error: '認證失敗' }), { status: 401, headers: corsH });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: '需要管理員權限' }), { status: 403, headers: corsH });
  }

  const url    = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const type   = params.type || 'overview';

  // ── Overview ──────────────────────────────────────────────
  if (type === 'overview') {
    const now  = new Date();
    const mk   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = now.toISOString().slice(0, 10);

    const [usersRes, analysesRes, monthRes, todayRes, stratRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('analyses').select('id', { count: 'exact', head: true }),
      supabase.from('quota_usage').select('used').eq('month_key', mk),
      supabase.from('analyses').select('id', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('analyses').select('strategy'),
    ]);

    const monthlyTotal = (monthRes.data || []).reduce((s, r) => s + (r.used || 0), 0);
    const stratCounts  = {};
    (stratRes.data || []).forEach(r => { stratCounts[r.strategy] = (stratCounts[r.strategy] || 0) + 1; });

    return new Response(
      JSON.stringify({
        success: true,
        overview: {
          totalUsers:      usersRes.count || 0,
          totalAnalyses:   analysesRes.count || 0,
          monthlyAnalyses: monthlyTotal,
          todayAnalyses:   todayRes.count || 0,
          strategyBreakdown: stratCounts,
        },
      }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } }
    );
  }

  // ── Users ─────────────────────────────────────────────────
  if (type === 'users') {
    const { data, error } = await supabase
      .from('admin_user_stats').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsH });
    return new Response(
      JSON.stringify({ success: true, users: data || [] }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } }
    );
  }

  // ── Analyses ──────────────────────────────────────────────
  if (type === 'analyses') {
    const limit  = parseInt(params.limit  || '50', 10);
    const offset = parseInt(params.offset || '0', 10);
    const { data, error, count } = await supabase
      .from('analyses')
      .select('id, project_name, strategy, risk_score, source, created_at, profiles!analyses_user_id_fkey(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsH });
    return new Response(
      JSON.stringify({ success: true, analyses: data || [], total: count || 0 }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } }
    );
  }

  // ── Update user (POST) ────────────────────────────────────
  if (request.method === 'POST') {
    let body;
    try { body = await request.json().catch(() => ({})); } catch { body = {}; }
    const { userId, plan, role } = body;
    if (!userId) return new Response(JSON.stringify({ error: '缺少 userId' }), { status: 400, headers: corsH });
    const updates = {};
    if (plan) updates.plan = plan;
    if (role) updates.role = role;
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsH });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsH });
  }

  return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), { status: 400, headers: corsH });
}
