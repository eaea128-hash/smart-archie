-- ============================================================
--  Smart Archie — Supabase PostgreSQL Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── 1. Profiles (extends auth.users) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  company     TEXT DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  avatar_url  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, company, role, plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'company', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    'free'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 2. Analyses ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analyses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL DEFAULT 'Untitled',
  strategy     TEXT NOT NULL DEFAULT 'replatform',
  risk_score   INTEGER DEFAULT 0,
  inputs       JSONB NOT NULL DEFAULT '{}',
  result       JSONB NOT NULL DEFAULT '{}',
  source       TEXT DEFAULT 'local' CHECK (source IN ('local', 'claude-api')),
  share_token  TEXT UNIQUE DEFAULT NULL,
  share_enabled BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analyses_user_id_idx ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS analyses_share_token_idx ON public.analyses(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS analyses_created_at_idx ON public.analyses(created_at DESC);

CREATE TRIGGER analyses_updated_at
  BEFORE UPDATE ON public.analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. Quota Usage ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quota_usage (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,  -- format: YYYY-MM
  used      INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, month_key)
);

CREATE INDEX IF NOT EXISTS quota_usage_user_month_idx ON public.quota_usage(user_id, month_key);

-- ── 4. Row Level Security ─────────────────────────────────────
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_usage  ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own profile; admins can read all
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Analyses: users can CRUD own; shared analyses readable by anyone; admins read all
CREATE POLICY "Users can view own analyses"
  ON public.analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON public.analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON public.analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON public.analyses FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Shared analyses are public"
  ON public.analyses FOR SELECT
  USING (share_enabled = TRUE AND share_token IS NOT NULL);

CREATE POLICY "Admins can view all analyses"
  ON public.analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Quota: users can read/update own; admins can read all
CREATE POLICY "Users can manage own quota"
  ON public.quota_usage FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all quota"
  ON public.quota_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 5. Seed Demo Accounts (run manually after setup) ─────────
-- NOTE: Create demo users via Supabase Auth dashboard or API first,
-- then run this to set their roles/plans.
--
-- UPDATE public.profiles SET role = 'admin', plan = 'enterprise'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@smartarchie.ai');
--
-- UPDATE public.profiles SET plan = 'pro'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'demo@smartarchie.ai');

-- ── 6. Helper function: increment quota ──────────────────────
CREATE OR REPLACE FUNCTION public.increment_quota(p_user_id UUID, p_month_key TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO public.quota_usage (user_id, month_key, used)
  VALUES (p_user_id, p_month_key, 1)
  ON CONFLICT (user_id, month_key)
  DO UPDATE SET used = quota_usage.used + 1
  RETURNING used INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Admin view: user stats ────────────────────────────────
CREATE OR REPLACE VIEW public.admin_user_stats AS
SELECT
  p.id,
  p.name,
  p.company,
  p.role,
  p.plan,
  p.created_at,
  u.email,
  u.email_confirmed_at,
  u.last_sign_in_at,
  COUNT(a.id) AS total_analyses,
  COALESCE(q.used, 0) AS this_month_analyses
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN public.analyses a ON a.user_id = p.id
LEFT JOIN public.quota_usage q ON q.user_id = p.id
  AND q.month_key = TO_CHAR(NOW(), 'YYYY-MM')
GROUP BY p.id, p.name, p.company, p.role, p.plan, p.created_at,
         u.email, u.email_confirmed_at, u.last_sign_in_at, q.used;
