-- ============================================================
-- CloudFrame — RAG Knowledge Base Schema
-- 在 Supabase SQL Editor 執行此檔案
-- ============================================================

-- 1. 啟用 pgvector 擴充
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 知識庫主表
CREATE TABLE IF NOT EXISTS knowledge_base (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT        NOT NULL,
  content       TEXT        NOT NULL,
  category      TEXT        NOT NULL CHECK (category IN (
                  'case_study',    -- 真實遷移案例
                  'compliance',    -- 合規法規要求（ISO 27001, MAS TRM, GDPR）
                  'vendor',        -- 雲端廠商比較（AWS/Azure/GCP）
                  'governance',    -- IT 治理框架（TOGAF, COBIT, Kotter）
                  'architecture',  -- 最佳實踐與架構模式
                  'pricing'        -- 定價與成本參考
                )),
  industry      TEXT,              -- 適用產業（banking, healthcare, retail, general）
  cloud_provider TEXT,             -- aws / azure / gcp / multi / null(通用)
  tags          TEXT[],            -- 自由標籤
  embedding     vector(1536),      -- OpenAI text-embedding-3-small
  source_url    TEXT,              -- 參考來源
  language      TEXT DEFAULT 'zh-TW', -- zh-TW / en
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 向量搜尋索引（IVFFlat，適合 < 100萬筆）
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx
  ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. 一般查詢索引
CREATE INDEX IF NOT EXISTS knowledge_base_category_idx ON knowledge_base (category);
CREATE INDEX IF NOT EXISTS knowledge_base_industry_idx ON knowledge_base (industry);
CREATE INDEX IF NOT EXISTS knowledge_base_active_idx   ON knowledge_base (is_active);

-- 5. RLS 政策
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- 任何人可以讀取（公開知識庫）
CREATE POLICY "knowledge_base_public_read"
  ON knowledge_base FOR SELECT
  USING (is_active = true);

-- 只有 service_role 可以寫入（管理員透過 API 新增）
-- （service_role 預設繞過 RLS，所以不需要額外 policy）

-- 6. 向量搜尋 RPC 函數
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding   vector(1536),
  match_count       INT     DEFAULT 5,
  filter_category   TEXT    DEFAULT NULL,
  filter_industry   TEXT    DEFAULT NULL,
  filter_provider   TEXT    DEFAULT NULL,
  min_similarity    FLOAT   DEFAULT 0.3
)
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  content       TEXT,
  category      TEXT,
  industry      TEXT,
  cloud_provider TEXT,
  tags          TEXT[],
  source_url    TEXT,
  similarity    FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.industry,
    kb.cloud_provider,
    kb.tags,
    kb.source_url,
    (1 - (kb.embedding <=> query_embedding))::FLOAT AS similarity
  FROM knowledge_base kb
  WHERE
    kb.is_active = true
    AND (filter_category IS NULL OR kb.category = filter_category)
    AND (filter_industry IS NULL OR kb.industry = filter_industry OR kb.industry = 'general')
    AND (filter_provider IS NULL OR kb.cloud_provider = filter_provider OR kb.cloud_provider = 'multi')
    AND (1 - (kb.embedding <=> query_embedding)) >= min_similarity
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 7. updated_at 自動更新觸發器
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_knowledge_base_updated_at();

-- ============================================================
-- 驗證安裝：執行以下查詢確認設定正確
-- SELECT COUNT(*) FROM knowledge_base;
-- SELECT * FROM pg_indexes WHERE tablename = 'knowledge_base';
-- ============================================================
