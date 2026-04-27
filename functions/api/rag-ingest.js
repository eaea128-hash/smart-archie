/**
 * CloudFrame — /api/rag-ingest
 * 知識庫文件新增（管理員限定）
 * 自動產生 OpenAI embedding 後存入 Supabase pgvector
 *
 * POST /api/rag-ingest
 * Headers: Authorization: Bearer <admin-supabase-token>
 * Body: {
 *   title: string,
 *   content: string,
 *   category: 'case_study'|'compliance'|'vendor'|'governance'|'architecture'|'pricing',
 *   industry?: string,      // banking, healthcare, retail, general ...
 *   cloud_provider?: string, // aws, azure, gcp, multi
 *   tags?: string[],
 *   source_url?: string,
 *   language?: string       // zh-TW（預設）或 en
 * }
 *
 * DELETE /api/rag-ingest
 * Body: { id: string }  → 軟刪除（is_active = false）
 */

import { createClient } from '@supabase/supabase-js';

const EMBED_MODEL = 'text-embedding-3-small';

const VALID_CATEGORIES = ['case_study','compliance','vendor','governance','architecture','pricing'];

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

async function getAdminUser(token, supabase) {
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return profile?.role === 'admin' ? user : null;
}

async function embed(text, openaiKey) {
  if (!openaiKey) throw new Error('OPENAI_API_KEY 未設定');
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8192) }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`OpenAI embedding 失敗：${err.error?.message || resp.statusText}`);
  }
  const data = await resp.json();
  return data.data[0].embedding;
}

export async function onRequest(context) {
  const { request, env } = context;

  const origin = request.headers.get('origin') || '*';
  const corsH  = cors(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });

  // Initialise Supabase inside handler
  const supabase  = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const openaiKey = env.OPENAI_API_KEY;

  // 驗證管理員
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  const admin  = await getAdminUser(token, supabase);
  if (!admin) {
    return new Response(JSON.stringify({ error: '需要管理員權限' }), { status: 403, headers: corsH });
  }

  let body;
  try { body = await request.json().catch(() => ({})); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsH }); }

  // ── DELETE：軟刪除 ────────────────────────────────────────────
  if (request.method === 'DELETE') {
    const { id } = body;
    if (!id) return new Response(JSON.stringify({ error: '缺少 id' }), { status: 400, headers: corsH });

    const { error } = await supabase.from('knowledge_base').update({ is_active: false }).eq('id', id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsH });
    return new Response(
      JSON.stringify({ success: true, message: '文件已停用' }),
      { status: 200, headers: corsH }
    );
  }

  // ── POST：新增文件 ────────────────────────────────────────────
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '僅支援 POST / DELETE' }), { status: 405, headers: corsH });
  }

  const {
    title, content, category,
    industry       = 'general',
    cloud_provider = null,
    tags           = [],
    source_url     = null,
    language       = 'zh-TW',
  } = body;

  // 驗證必填欄位
  if (!title?.trim())   return new Response(JSON.stringify({ error: '缺少 title' }), { status: 400, headers: corsH });
  if (!content?.trim()) return new Response(JSON.stringify({ error: '缺少 content' }), { status: 400, headers: corsH });
  if (!VALID_CATEGORIES.includes(category)) {
    return new Response(
      JSON.stringify({ error: `category 必須是：${VALID_CATEGORIES.join(' | ')}` }),
      { status: 400, headers: corsH }
    );
  }

  try {
    // Embed：標題 + 內容合併，讓搜尋更準確
    const textToEmbed = `${title}\n\n${content}`;
    const embedding   = await embed(textToEmbed, openaiKey);

    // 存入資料庫
    const { data, error } = await supabase.from('knowledge_base').insert({
      title:         title.trim(),
      content:       content.trim(),
      category,
      industry:      industry || 'general',
      cloud_provider: cloud_provider || null,
      tags:          Array.isArray(tags) ? tags : [],
      source_url:    source_url || null,
      language,
      embedding,
    }).select('id, title, category, created_at').single();

    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ success: true, document: data }),
      { status: 201, headers: { ...corsH, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[rag-ingest] error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsH }
    );
  }
}
