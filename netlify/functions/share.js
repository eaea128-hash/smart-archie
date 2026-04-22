/**
 * CloudFrame — /api/share
 * 建立或取消分析報告的公開分享連結
 *
 * POST /api/share          → 建立/更新分享（需要 token）
 * GET  /api/share?token=xx → 取得公開分享的報告（不需要 token）
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes }  from 'crypto';

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

  // ── GET：公開讀取分享報告 ─────────────────────────────────
  if (event.httpMethod === 'GET') {
    const shareToken = event.queryStringParameters?.token;
    if (!shareToken) return {
      statusCode: 400, headers: corsH,
      body: JSON.stringify({ error: '缺少 share token' })
    };

    const { data, error } = await supabase
      .from('analyses')
      .select('id, project_name, strategy, risk_score, result, inputs, source, created_at')
      .eq('share_token', shareToken)
      .eq('share_enabled', true)
      .single();

    if (error || !data) return {
      statusCode: 404, headers: corsH,
      body: JSON.stringify({ error: '找不到此分享報告，可能已被取消分享' })
    };

    return {
      statusCode: 200,
      headers: { ...corsH, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({ success: true, analysis: data }),
    };
  }

  // ── POST：建立 / 切換分享 ─────────────────────────────────
  if (event.httpMethod === 'POST') {
    const token = (event.headers?.authorization || '').replace('Bearer ', '').trim();
    if (!token) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '未提供認證' }) };

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '認證失敗' }) };

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
    const { analysisId, enable = true } = body;

    if (!analysisId) return { statusCode: 400, headers: corsH, body: JSON.stringify({ error: '缺少 analysisId' }) };

    // 確認是本人的分析
    const { data: analysis } = await supabase
      .from('analyses').select('id, share_token').eq('id', analysisId).eq('user_id', user.id).single();
    if (!analysis) return { statusCode: 403, headers: corsH, body: JSON.stringify({ error: '無權存取此分析' }) };

    if (enable) {
      // 建立 share token（若尚未有）
      const shareToken = analysis.share_token || randomBytes(16).toString('hex');
      const { error: updateErr } = await supabase.from('analyses').update({
        share_token:   shareToken,
        share_enabled: true,
      }).eq('id', analysisId);

      if (updateErr) return { statusCode: 500, headers: corsH, body: JSON.stringify({ error: updateErr.message }) };

      const shareUrl = `${process.env.URL || 'https://unique-jelly-da79b4.netlify.app'}/share.html?token=${shareToken}`;
      return {
        statusCode: 200,
        headers: { ...corsH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, shareToken, shareUrl }),
      };
    } else {
      // 取消分享
      await supabase.from('analyses').update({ share_enabled: false }).eq('id', analysisId);
      return {
        statusCode: 200,
        headers: { ...corsH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: '已取消分享' }),
      };
    }
  }

  return { statusCode: 405, headers: corsH, body: '{}' };
};
