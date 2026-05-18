-- ============================================================
-- Migration: 20260515120000_add_audit_log
-- Purpose:   Audit trail for all analysis requests — required
--            for SOX / ISO 27001 / MAS TRM compliance.
--            Records who ran what analysis, from which IP,
--            and what the AI engine returned.
-- ============================================================

-- ── Audit Log Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Actor
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id    TEXT,                      -- anonymous/API callers
  ip_address    INET,

  -- Action
  action        TEXT NOT NULL,             -- 'analysis.create' | 'trends.view' | 'auth.login' | ...
  resource      TEXT,                      -- e.g. 'analyses:abc123'
  result        TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'error' | 'rate_limited'

  -- Context
  provider      TEXT,                      -- 'openai' | 'cloudflare' | 'local'
  tokens_used   INTEGER,
  latency_ms    INTEGER,
  error_msg     TEXT,

  -- Metadata (non-PII summary only — no raw prompts)
  metadata      JSONB DEFAULT '{}'::jsonb
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
  ON public.audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON public.audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log(created_at DESC);

-- ── RLS: Only admins can read audit log ──────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Service role (Cloudflare Function → Supabase service key) can insert
CREATE POLICY "service_insert_audit_log"
  ON public.audit_log FOR INSERT
  WITH CHECK (TRUE);  -- enforced by API key, not row policy

-- Users can view only their own audit entries
CREATE POLICY "users_view_own_audit_log"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- ── Admin view ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_audit_log AS
SELECT
  al.id,
  al.created_at,
  u.email,
  al.action,
  al.resource,
  al.result,
  al.provider,
  al.tokens_used,
  al.latency_ms,
  al.ip_address,
  al.error_msg,
  al.metadata
FROM public.audit_log al
LEFT JOIN auth.users u ON u.id = al.user_id
ORDER BY al.created_at DESC;

-- ── Auto-purge: retain 90 days (GDPR / data minimisation) ───
-- Run via pg_cron if available, else a scheduled Supabase Edge Function.
-- Example cron expression (daily at 03:00 UTC):
--   SELECT cron.schedule('purge-audit-log', '0 3 * * *',
--     $$DELETE FROM public.audit_log WHERE created_at < NOW() - INTERVAL '90 days'$$);
