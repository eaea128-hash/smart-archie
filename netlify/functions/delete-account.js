/**
 * CloudFrame — /api/delete-account
 * 刪除當前登入用戶的所有資料（分析記錄 + 個人資料 + Auth 帳號）
 *
 * DELETE /api/delete-account
 * Headers: Authorization: Bearer <supabase-access-token>
 */

import { createClient } from '@supabase/supabase-js';

// 使用 service_role 金鑰才能刪除 auth user
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export const handler = async (event) => {
  const corsH = cors(event.headers?.origin || '*');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsH, body: '' };
  if (event.httpMethod !== 'DELETE') {
    return { statusCode: 405, headers: corsH, body: JSON.stringify({ error: '僅支援 DELETE 方法' }) };
  }

  // ── 驗證 Token ───────────────────────────────────────────────
  const token = (event.headers?.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '未提供 Token' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '認證失敗，請重新登入' }) };
  }

  const userId = user.id;

  try {
    // 1. 刪除所有分析記錄
    const { error: analysesErr } = await supabase
      .from('analyses')
      .delete()
      .eq('user_id', userId);
    if (analysesErr) throw new Error(`刪除分析記錄失敗：${analysesErr.message}`);

    // 2. 刪除配額使用記錄
    const { error: quotaErr } = await supabase
      .from('quota_usage')
      .delete()
      .eq('user_id', userId);
    // quota_usage 表可能不存在或欄位不同，忽略錯誤
    if (quotaErr) console.warn('quota_usage delete warn:', quotaErr.message);

    // 3. 刪除個人資料
    const { error: profileErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profileErr) throw new Error(`刪除個人資料失敗：${profileErr.message}`);

    // 4. 刪除 Supabase Auth 帳號（需要 service_role）
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId);
    if (deleteErr) throw new Error(`刪除帳號失敗：${deleteErr.message}`);

    return {
      statusCode: 200,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: '帳號與所有資料已永久刪除' }),
    };

  } catch (err) {
    console.error('[delete-account] error:', err.message);
    return {
      statusCode: 500,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
