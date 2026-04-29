/**
 * CloudFrame — /api/admin-data
 * 管理員專用：SaaS 後台完整指標與用戶管理
 *
 * GET /api/admin-data?type=overview|growth|segments|users|analyses|health
 * POST /api/admin-data  (update user plan/role)
 */

import { createClient } from '@supabase/supabase-js';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function last6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({ key: monthKey(d), label: `${d.getMonth() + 1}月` });
  }
  return months;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '*';
  const corsH  = cors(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });

  const supabase = createClient('https://oxownfzafrveihxhuxay.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

  // ── Auth + Admin check ────────────────────────────────────
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return new Response(JSON.stringify({ error: '未提供 Token' }), { status: 401, headers: corsH });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return new Response(JSON.stringify({ error: '認證失敗' }), { status: 401, headers: corsH });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: '需要管理員權限' }), { status: 403, headers: corsH });
  }

  const url    = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const type   = params.type || 'overview';

  // ── POST: update user ─────────────────────────────────────
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

  // ── Overview KPIs ─────────────────────────────────────────
  if (type === 'overview') {
    const now      = new Date();
    const mk       = monthKey(now);
    const prevDate = new Date(now); prevDate.setMonth(prevDate.getMonth() - 1);
    const mk_prev  = monthKey(prevDate);
    const today    = now.toISOString().slice(0, 10);
    const last30   = new Date(now); last30.setDate(last30.getDate() - 30);
    const monthStart = `${mk}-01`;
    const prevStart  = `${mk_prev}-01`;
    const prevEnd    = `${mk}-01`;

    const [
      totalUsersRes, newUsersThisMonthRes, newUsersPrevMonthRes,
      totalAnalysesRes, monthAnalysesRes, prevMonthAnalysesRes,
      todayRes, activeUsersRes,
      planRes, stratRes,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd),
      supabase.from('analyses').select('id', { count: 'exact', head: true }),
      supabase.from('analyses').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
      supabase.from('analyses').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd),
      supabase.from('analyses').select('id', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('analyses').select('user_id').gte('created_at', last30.toISOString()).limit(1000),
      supabase.from('profiles').select('plan'),
      supabase.from('analyses').select('strategy, source, risk_score').not('strategy', 'is', null).limit(500),
    ]);

    const planCounts = { free: 0, pro: 0, enterprise: 0 };
    (planRes.data || []).forEach(p => { const k = p.plan || 'free'; if (planCounts[k] !== undefined) planCounts[k]++; });
    const paidUsers = planCounts.pro + planCounts.enterprise;
    const totalU    = totalUsersRes.count || 0;
    const convRate  = totalU > 0 ? Math.round(paidUsers / totalU * 100) : 0;

    const activeUserIds = new Set((activeUsersRes.data || []).map(r => r.user_id));
    const mau = activeUserIds.size;

    const stratCounts = {};
    let riskSum = 0; let riskCnt = 0; let aiCnt = 0;
    (stratRes.data || []).forEach(r => {
      if (r.strategy) stratCounts[r.strategy] = (stratCounts[r.strategy] || 0) + 1;
      if (r.risk_score > 0) { riskSum += r.risk_score; riskCnt++; }
      if (r.source === 'claude-api') aiCnt++;
    });
    const topStratEntry = Object.entries(stratCounts).sort((a,b) => b[1]-a[1])[0];
    const stratLabels = { rehost:'Rehost', replatform:'Replatform', refactor:'Refactor', retain:'Retain', retire:'Retire' };

    const monthTotal = monthAnalysesRes.count || 0;
    const prevTotal  = prevMonthAnalysesRes.count || 0;
    const analysesMoM = prevTotal > 0 ? Math.round((monthTotal - prevTotal) / prevTotal * 100) : 0;
    const newUsersM   = newUsersThisMonthRes.count || 0;
    const newUsersPrev = newUsersPrevMonthRes.count || 0;
    const usersMoM    = newUsersPrev > 0 ? Math.round((newUsersM - newUsersPrev) / newUsersPrev * 100) : 0;

    return new Response(JSON.stringify({
      success: true,
      overview: {
        totalUsers:        totalU,
        newUsersThisMonth: newUsersM,
        usersMoM,
        mau,
        mauPct:            totalU > 0 ? Math.round(mau / totalU * 100) : 0,
        totalAnalyses:     totalAnalysesRes.count || 0,
        monthAnalyses:     monthTotal,
        analysesMoM,
        todayAnalyses:     todayRes.count || 0,
        conversionRate:    convRate,
        paidUsers,
        planBreakdown:     planCounts,
        strategyBreakdown: stratCounts,
        topStrategy:       topStratEntry ? stratLabels[topStratEntry[0]] || topStratEntry[0] : '—',
        topStratPct:       topStratEntry ? Math.round(topStratEntry[1] / (stratRes.data?.length || 1) * 100) : 0,
        avgRiskScore:      riskCnt > 0 ? Math.round(riskSum / riskCnt) : 0,
        aiUsagePct:        stratRes.data?.length > 0 ? Math.round(aiCnt / stratRes.data.length * 100) : 0,
      },
    }), { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } });
  }

  // ── Growth trend (last 6 months) ──────────────────────────
  if (type === 'growth') {
    const months = last6Months();
    const results = await Promise.all(months.map(async m => {
      const start = `${m.key}-01`;
      const endD  = new Date(start); endD.setMonth(endD.getMonth() + 1);
      const end   = endD.toISOString().slice(0, 10);
      const [u, a] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
        supabase.from('analyses').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
      ]);
      return { label: m.label, newUsers: u.count || 0, analyses: a.count || 0 };
    }));
    return new Response(JSON.stringify({ success: true, growth: results }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } });
  }

  // ── Segments (industry, cloud, risk distribution) ─────────
  if (type === 'segments') {
    const { data: analyses } = await supabase
      .from('analyses').select('inputs, strategy, risk_score').not('inputs', 'is', null).limit(500);

    const industries = {}; const clouds = {}; const risks = [0,0,0]; // low/mid/high
    (analyses || []).forEach(a => {
      const inp = a.inputs || {};
      const ind = inp.industry || inp.industryVertical;
      const cl  = inp.targetCloud;
      if (ind) industries[ind] = (industries[ind] || 0) + 1;
      if (cl)  clouds[cl]  = (clouds[cl]  || 0) + 1;
      const rs = a.risk_score || 0;
      if (rs >= 70) risks[2]++; else if (rs >= 40) risks[1]++; else if (rs > 0) risks[0]++;
    });

    const topIndustries = Object.entries(industries).sort((a,b)=>b[1]-a[1]).slice(0,6)
      .map(([k,v]) => ({ label: k, count: v }));
    const topClouds = Object.entries(clouds).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([k,v]) => ({ label: k, count: v }));

    return new Response(JSON.stringify({ success: true, segments: { topIndustries, topClouds, riskDist: risks } }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } });
  }

  // ── Users list ────────────────────────────────────────────
  if (type === 'users') {
    // Try with email first (requires ALTER TABLE profiles ADD COLUMN email TEXT)
    let { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, company, plan, role, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      // Fallback: email column may not exist yet
      ({ data, error } = await supabase
        .from('profiles')
        .select('id, name, company, plan, role, created_at')
        .order('created_at', { ascending: false })
        .limit(200));
    }
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsH });

    // Enrich with analysis count
    const enriched = await Promise.all((data || []).map(async u => {
      const { count } = await supabase.from('analyses')
        .select('id', { count: 'exact', head: true }).eq('user_id', u.id);
      const { count: monthCount } = await supabase.from('analyses')
        .select('id', { count: 'exact', head: true }).eq('user_id', u.id)
        .gte('created_at', `${monthKey(new Date())}-01`);
      return { ...u, totalAnalyses: count || 0, monthAnalyses: monthCount || 0 };
    }));

    return new Response(JSON.stringify({ success: true, users: enriched }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } });
  }

  // ── Analyses list ─────────────────────────────────────────
  if (type === 'analyses') {
    const limit  = parseInt(params.limit  || '50', 10);
    const offset = parseInt(params.offset || '0', 10);

    // Try with prompt_version first (requires ALTER TABLE analyses ADD COLUMN prompt_version TEXT)
    let { data, error, count } = await supabase
      .from('analyses')
      .select('id, project_name, strategy, risk_score, source, prompt_version, created_at, user_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      // Fallback: prompt_version column may not exist yet
      ({ data, error, count } = await supabase
        .from('analyses')
        .select('id, project_name, strategy, risk_score, source, created_at, user_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1));
    }
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsH });

    // Enrich with profile info (two-step — analyses.user_id → auth.users, profiles.id → auth.users)
    const userIds = [...new Set((data || []).map(a => a.user_id))];
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles').select('id, name, email').in('id', userIds);
      (profs || []).forEach(p => { profileMap[p.id] = p; });
    }
    const enriched = (data || []).map(a => ({ ...a, profiles: profileMap[a.user_id] || {} }));

    return new Response(JSON.stringify({ success: true, analyses: enriched, total: count || 0 }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), { status: 400, headers: corsH });
}
