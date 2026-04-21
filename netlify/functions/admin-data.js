/**
 * Smart Archie — /api/admin-data
 * 管理員專用：取得完整用戶統計與分析數據
 *
 * GET /api/admin-data?type=overview|users|analyses
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export const handler = async (event) => {
  const corsH = cors(event.headers?.origin || '*');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsH, body: '' };

  // ── 驗證並確認是管理員 ────────────────────────────────────
  const token = (event.headers?.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '未提供 Token' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '認證失敗' }) };

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return {
    statusCode: 403, headers: corsH,
    body: JSON.stringify({ error: '需要管理員權限' })
  };

  const type = event.queryStringParameters?.type || 'overview';

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

    return {
      statusCode: 200,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        overview: {
          totalUsers:      usersRes.count || 0,
          totalAnalyses:   analysesRes.count || 0,
          monthlyAnalyses: monthlyTotal,
          todayAnalyses:   todayRes.count || 0,
          strategyBreakdown: stratCounts,
        },
      }),
    };
  }

  // ── Users ─────────────────────────────────────────────────
  if (type === 'users') {
    const { data, error } = await supabase
      .from('admin_user_stats').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return { statusCode: 500, headers: corsH, body: JSON.stringify({ error: error.message }) };
    return {
      statusCode: 200,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, users: data || [] }),
    };
  }

  // ── Analyses ──────────────────────────────────────────────
  if (type === 'analyses') {
    const limit  = parseInt(event.queryStringParameters?.limit  || '50', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const { data, error, count } = await supabase
      .from('analyses')
      .select('id, project_name, strategy, risk_score, source, created_at, profiles!analyses_user_id_fkey(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return { statusCode: 500, headers: corsH, body: JSON.stringify({ error: error.message }) };
    return {
      statusCode: 200,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, analyses: data || [], total: count || 0 }),
    };
  }

  // ── Update user (POST) ────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
    const { userId, plan, role } = body;
    if (!userId) return { statusCode: 400, headers: corsH, body: JSON.stringify({ error: '缺少 userId' }) };
    const updates = {};
    if (plan) updates.plan = plan;
    if (role) updates.role = role;
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) return { statusCode: 500, headers: corsH, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: corsH, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 400, headers: corsH, body: JSON.stringify({ error: `Unknown type: ${type}` }) };
};
