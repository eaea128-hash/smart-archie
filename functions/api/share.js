/**
 * CloudFrame — /api/share
 * 建立或取消分析報告的公開分享連結
 *
 * POST /api/share          → 建立/更新分享（需要 token）
 * GET  /api/share?token=xx → 取得公開分享的報告（不需要 token）
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes }  from 'crypto';

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
  const supabase = createClient('https://oxownfzafrveihxhuxay.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

  // ── GET：公開讀取分享報告 ─────────────────────────────────
  if (request.method === 'GET') {
    const url        = new URL(request.url);
    const shareToken = url.searchParams.get('token');
    if (!shareToken) {
      return new Response(
        JSON.stringify({ error: '缺少 share token' }),
        { status: 400, headers: corsH }
      );
    }

    const { data, error } = await supabase
      .from('analyses')
      .select('id, project_name, strategy, risk_score, result, inputs, source, created_at')
      .eq('share_token', shareToken)
      .eq('share_enabled', true)
      .maybeSingle();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: '找不到此分享報告，可能已被取消分享' }),
        { status: 404, headers: corsH }
      );
    }

    return new Response(
      JSON.stringify({ success: true, analysis: data }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } }
    );
  }

  // ── POST：建立 / 切換分享 ─────────────────────────────────
  if (request.method === 'POST') {
    const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: '未提供認證' }), { status: 401, headers: corsH });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: '認證失敗' }), { status: 401, headers: corsH });
    }

    let body;
    try { body = await request.json().catch(() => ({})); } catch { body = {}; }
    const { analysisId, enable = true } = body;

    if (!analysisId) {
      return new Response(JSON.stringify({ error: '缺少 analysisId' }), { status: 400, headers: corsH });
    }

    // 確認是本人的分析
    const { data: analysis } = await supabase
      .from('analyses').select('id, share_token').eq('id', analysisId).eq('user_id', user.id).maybeSingle();
    if (!analysis) {
      return new Response(JSON.stringify({ error: '無權存取此分析' }), { status: 403, headers: corsH });
    }

    if (enable) {
      // 建立 share token（若尚未有）
      const shareToken = analysis.share_token || randomBytes(16).toString('hex');
      const { error: updateErr } = await supabase.from('analyses').update({
        share_token:   shareToken,
        share_enabled: true,
      }).eq('id', analysisId);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: corsH });
      }

      const baseUrl  = env.URL || 'https://unique-jelly-da79b4.netlify.app';
      const shareUrl = `${baseUrl}/share.html?token=${shareToken}`;
      return new Response(
        JSON.stringify({ success: true, shareToken, shareUrl }),
        { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } }
      );
    } else {
      // 取消分享
      await supabase.from('analyses').update({ share_enabled: false }).eq('id', analysisId);
      return new Response(
        JSON.stringify({ success: true, message: '已取消分享' }),
        { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response('{}', { status: 405, headers: corsH });
}
