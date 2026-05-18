-- ============================================================
-- Migration: 20260515130000_add_api_rate_log
-- Purpose:   Persistent rate limiting table — survives
--            Cloudflare Worker cold starts.
--            Used by /api/analyze to enforce per-IP/session
--            hourly request limits across all worker instances.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_rate_log (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  identifier  TEXT        NOT NULL,  -- hashed IP or session ID (max 128 chars)
  endpoint    TEXT        NOT NULL DEFAULT 'analyze'
);

-- Index for the COUNT query in rate limit check
CREATE INDEX IF NOT EXISTS idx_api_rate_log_ident
  ON public.api_rate_log(identifier, created_at DESC);

-- RLS: only service role can insert/read (no user-level access)
ALTER TABLE public.api_rate_log ENABLE ROW LEVEL SECURITY;

-- Service role (Cloudflare Function key) can do everything
-- No user-facing policies needed — this table is internal only

-- ── Auto-purge old records ────────────────────────────────────
-- Keep only last 2 hours of data (rate limit window is 1 hour)
-- Run via pg_cron if available:
--   SELECT cron.schedule('purge-rate-log', '0 * * * *',
--     $$DELETE FROM public.api_rate_log WHERE created_at < NOW() - INTERVAL '2 hours'$$);
--
-- Or create a scheduled Supabase Edge Function to call this periodically.
