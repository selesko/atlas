-- Atlas App — Production schema
-- Database: PostgreSQL (Supabase-compatible)
-- Multi-user: all tables are scoped by user_id.

-- =============================================================================
-- PROFILES (User Manifest)
-- One row per user. Holds Profile tab: cognitive model, peak period, motivators, identity notes.
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE,
  cognitive_model  TEXT NOT NULL DEFAULT 'Architect' CHECK (cognitive_model IN ('Architect', 'Strategist', 'Builder', 'Analyst')),
  peak_period   TEXT NOT NULL DEFAULT 'MORNING' CHECK (peak_period IN ('MORNING', 'EVENING')),
  motivators    JSONB NOT NULL DEFAULT '[]',  -- e.g. ["DISCIPLINE", "GROWTH", "LEGACY"]
  identity_notes TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);

-- =============================================================================
-- EVIDENCE_LOGS (Mind/Body/Home scores and why statements)
-- One row per calibration event: user sets a score and optional "why" for a coordinate.
-- Current score for a coordinate = latest log for (user_id, coordinate_id).
-- =============================================================================
CREATE TABLE IF NOT EXISTS evidence_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  node_id         TEXT NOT NULL,           -- e.g. 'mind', 'body', 'home'
  coordinate_id   TEXT NOT NULL,           -- e.g. 'm1', 'b1', 'h1'
  coordinate_name TEXT NOT NULL,           -- denormalized for display/history
  score           SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  why_statement   TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_logs_user_id ON evidence_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_logs_user_coordinate ON evidence_logs (user_id, coordinate_id);
CREATE INDEX IF NOT EXISTS idx_evidence_logs_created_at ON evidence_logs (user_id, created_at DESC);

-- =============================================================================
-- ROW-LEVEL SECURITY (Supabase/Postgres)
-- Ensure users only access their own rows. Enable RLS and policies in production.
-- =============================================================================
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE evidence_logs ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = user_id);
--
-- CREATE POLICY "evidence_logs_select_own" ON evidence_logs FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "evidence_logs_insert_own" ON evidence_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "evidence_logs_delete_own" ON evidence_logs FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- HELPER: updated_at trigger for profiles
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
