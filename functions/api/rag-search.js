/**
 * CloudFrame — /api/rag-search
 * 向量語義搜尋：將查詢 embed 後搜尋知識庫
 *
 * POST /api/rag-search
 * Body: {
 *   query: string,          // 搜尋查詢（自然語言）
 *   category?: string,      // 篩選類別
 *   industry?: string,      // 篩選產業
 *   provider?: string,      // 篩選雲端廠商
 *   limit?: number,         // 回傳筆數（預設 5）
 *   minSimilarity?: number  // 最低相似度（預設 0.3）
 * }
 */

import { createClient } from '@supabase/supabase-js';

const EMBED_MODEL = 'text-embedding-3-small';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ── OpenAI Embedding ──────────────────────────────────────────
async function embed(text, openaiKey) {
  if (!openaiKey) throw new Error('OPENAI_API_KEY 未設定');

  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text.slice(0, 8192), // token limit
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`OpenAI embedding 失敗：${err.error?.message || resp.statusText}`);
  }

  const data = await resp.json();
  return data.data[0].embedding; // float[]
}

// ── Main Handler ──────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  const origin = request.headers.get('origin') || '*';
  const corsH  = cors(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '僅支援 POST' }), { status: 405, headers: corsH });
  }

  const openaiKey = env.OPENAI_API_KEY;

  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: 'RAG 尚未設定（需要 OPENAI_API_KEY）', results: [] }),
      { status: 503, headers: corsH }
    );
  }

  let body;
  try { body = await request.json().catch(() => ({})); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsH }); }

  const {
    query,
    category      = null,
    industry      = null,
    provider      = null,
    limit         = 5,
    minSimilarity = 0.3,
  } = body;

  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return new Response(
      JSON.stringify({ error: '請提供搜尋查詢（至少 3 個字）' }),
      { status: 400, headers: corsH }
    );
  }

  try {
    // Initialise Supabase inside handler
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. 取得 query embedding
    const embedding = await embed(query.trim(), openaiKey);

    // 2. 向量搜尋
    const { data, error } = await supabase.rpc('search_knowledge', {
      query_embedding: embedding,
      match_count:     Math.min(limit, 20),
      filter_category: category  || null,
      filter_industry: industry  || null,
      filter_provider: provider  || null,
      min_similarity:  minSimilarity,
    });

    if (error) throw new Error(`向量搜尋失敗：${error.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        query,
        results: data || [],
        count:   (data || []).length,
      }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[rag-search] error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message, results: [] }),
      { status: 500, headers: corsH }
    );
  }
}
