/**
 * CloudFrame — /api/save-analysis
 * 儲存分析結果至 Supabase 資料庫
 * 儲存後自動檢查配額，達 80% 時發送 Email 提醒
 *
 * POST /api/save-analysis
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: { projectName, strategy, riskScore, inputs, result, source }
 */

import { createClient }            from '@supabase/supabase-js';
import { sendQuotaWarningEmail }   from './_email.js';

const PLAN_LIMITS = { free: 3, pro: 30, enterprise: Infinity };
const WARN_PCT    = 0.8; // 80% 觸發警告

function cors(origin, allowedOriginsStr) {
  const allowed = allowedOriginsStr?.split(',').map(s => s.trim()) || [];
  const allowOrigin = (!allowed.length || allowed.includes(origin)) ? origin : allowed[0] || '*';
  return {
    'Access-Control-Allow-Origin':  allowOrigin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  const origin = request.headers.get('origin') || '*';
  const corsH  = cors(origin, env.ALLOWED_ORIGINS);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (request.method !== 'POST') return new Response('{}', { status: 405, headers: corsH });

  // Initialise Supabase inside handler
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // ── 驗證 JWT ─────────────────────────────────────────────
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: '未提供認證 Token' }), { status: 401, headers: corsH });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: '認證失敗，請重新登入' }), { status: 401, headers: corsH });
  }

  // ── 解析 body ─────────────────────────────────────────────
  let body;
  try { body = await request.json().catch(() => ({})); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsH }); }

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
    return new Response(JSON.stringify({ error: '儲存失敗：' + error.message }), { status: 500, headers: corsH });
  }

  // ── 配額警告 Email（非同步，不阻塞回應）────────────────────
  checkAndSendQuotaWarning(user.id, supabase, env).catch(err =>
    console.warn('[save-analysis] quota warning skipped:', err.message)
  );

  return new Response(
    JSON.stringify({ success: true, id: data.id, created_at: data.created_at }),
    { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } }
  );
}

// ── 配額檢查與 Email 通知 ─────────────────────────────────────
async function checkAndSendQuotaWarning(userId, supabase, env) {
  // 取得用戶 profile
  const { data: profile } = await supabase
    .from('profiles').select('name, email, plan').eq('id', userId).maybeSingle();
  if (!profile?.email) return;

  const plan  = profile.plan || 'free';
  const limit = PLAN_LIMITS[plan] ?? 3;
  if (!isFinite(limit)) return; // enterprise：無限額度，不發警告

  // 計算本月使用次數
  const now     = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const { count } = await supabase
    .from('analyses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStart);

  const used = count || 0;

  // 只在剛好跨越 80% 門檻時發送（避免每次都發）
  // 條件：used === Math.ceil(limit * WARN_PCT) 或是最後一次（used === limit）
  const warnAt    = Math.ceil(limit * WARN_PCT);
  const shouldWarn = (used === warnAt) || (used === limit);
  if (!shouldWarn) return;

  await sendQuotaWarningEmail({
    to:    profile.email,
    name:  profile.name || profile.email.split('@')[0],
    used,
    limit,
    plan,
  }, env);
}
