-- Atlas App — Production schema
-- Database: PostgreSQL (Supabase-compatible)
-- Multi-user: all tables are scoped by user_id and tied to auth.users.

-- 1. CREATE TABLES (if they don't exist yet)
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE,
  cognitive_model  TEXT NOT NULL DEFAULT 'Architect' CHECK (cognitive_model IN ('Architect', 'Strategist', 'Builder', 'Analyst')),
  peak_period   TEXT NOT NULL DEFAULT 'MORNING' CHECK (peak_period IN ('MORNING', 'EVENING')),
  motivators    JSONB NOT NULL DEFAULT '[]',
  identity_notes TEXT NOT NULL DEFAULT '',
  persona       TEXT NOT NULL DEFAULT 'Seeker',
  has_completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nodes (
  id            TEXT NOT NULL,
  user_id       UUID NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  why           TEXT NOT NULL DEFAULT '',
  color         TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS coordinates (
  id            TEXT NOT NULL,
  user_id       UUID NOT NULL,
  node_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  value         SMALLINT NOT NULL DEFAULT 5,
  score_history JSONB NOT NULL DEFAULT '[]',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT NOT NULL,
  user_id       UUID NOT NULL,
  node_id       TEXT NOT NULL,
  goal_id       TEXT NOT NULL,
  title         TEXT NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  is_priority   BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT NOT NULL DEFAULT '',
  due_date      TEXT NOT NULL DEFAULT '',
  reminder      TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT '',
  completed_at  TEXT NOT NULL DEFAULT '',
  timestamp     TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS evidence_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  node_id         TEXT NOT NULL,
  coordinate_id   TEXT NOT NULL,
  coordinate_name TEXT NOT NULL,
  score           SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  why_statement   TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE,
  status        TEXT NOT NULL,
  plan_id       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ADD MISSING COLUMNS TO EXISTING TABLES
-- (Because CREATE TABLE IF NOT EXISTS ignores columns if the table already existed)
-- =============================================================================

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS persona TEXT NOT NULL DEFAULT 'Seeker',
  ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE coordinates
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE evidence_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. ENSURE FOREIGN KEYS & CASCADES ON EXISTING TABLES
-- =============================================================================

-- profiles -> auth.users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- nodes -> auth.users
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_user_id_fkey;
ALTER TABLE nodes ADD CONSTRAINT nodes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- coordinates -> auth.users & nodes
ALTER TABLE coordinates DROP CONSTRAINT IF EXISTS coordinates_user_id_fkey;
ALTER TABLE coordinates ADD CONSTRAINT coordinates_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE coordinates DROP CONSTRAINT IF EXISTS coordinates_node_fkey;
ALTER TABLE coordinates ADD CONSTRAINT coordinates_node_fkey 
  FOREIGN KEY (node_id, user_id) REFERENCES nodes(id, user_id) ON DELETE CASCADE;

-- tasks -> auth.users & coordinates
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_goal_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_goal_fkey 
  FOREIGN KEY (goal_id, user_id) REFERENCES coordinates(id, user_id) ON DELETE CASCADE;

-- evidence_logs -> auth.users
ALTER TABLE evidence_logs DROP CONSTRAINT IF EXISTS evidence_logs_user_id_fkey;
ALTER TABLE evidence_logs ADD CONSTRAINT evidence_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- subscriptions -> auth.users
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. INDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_logs_user_id ON evidence_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_logs_user_coordinate ON evidence_logs (user_id, coordinate_id);
CREATE INDEX IF NOT EXISTS idx_evidence_logs_created_at ON evidence_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);

-- 5. ROW-LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist so we can recreate them safely
DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

  DROP POLICY IF EXISTS "nodes_select_own" ON nodes;
  DROP POLICY IF EXISTS "nodes_insert_own" ON nodes;
  DROP POLICY IF EXISTS "nodes_update_own" ON nodes;
  DROP POLICY IF EXISTS "nodes_delete_own" ON nodes;

  DROP POLICY IF EXISTS "coordinates_select_own" ON coordinates;
  DROP POLICY IF EXISTS "coordinates_insert_own" ON coordinates;
  DROP POLICY IF EXISTS "coordinates_update_own" ON coordinates;
  DROP POLICY IF EXISTS "coordinates_delete_own" ON coordinates;

  DROP POLICY IF EXISTS "tasks_select_own" ON tasks;
  DROP POLICY IF EXISTS "tasks_insert_own" ON tasks;
  DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
  DROP POLICY IF EXISTS "tasks_delete_own" ON tasks;

  DROP POLICY IF EXISTS "evidence_logs_select_own" ON evidence_logs;
  DROP POLICY IF EXISTS "evidence_logs_insert_own" ON evidence_logs;
  DROP POLICY IF EXISTS "evidence_logs_update_own" ON evidence_logs;
  DROP POLICY IF EXISTS "evidence_logs_delete_own" ON evidence_logs;

  DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
  DROP POLICY IF EXISTS "subscriptions_insert_own" ON subscriptions;
  DROP POLICY IF EXISTS "subscriptions_update_own" ON subscriptions;
  DROP POLICY IF EXISTS "subscriptions_delete_own" ON subscriptions;
EXCEPTION WHEN OTHERS THEN END $$;

-- Create policies
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "nodes_select_own" ON nodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nodes_insert_own" ON nodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nodes_update_own" ON nodes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "nodes_delete_own" ON nodes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "coordinates_select_own" ON coordinates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "coordinates_insert_own" ON coordinates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "coordinates_update_own" ON coordinates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "coordinates_delete_own" ON coordinates FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "tasks_select_own" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tasks_delete_own" ON tasks FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "evidence_logs_select_own" ON evidence_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "evidence_logs_insert_own" ON evidence_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "evidence_logs_update_own" ON evidence_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "evidence_logs_delete_own" ON evidence_logs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_select_own" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_insert_own" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subscriptions_update_own" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_delete_own" ON subscriptions FOR DELETE USING (auth.uid() = user_id);

-- 6. HELPER: updated_at triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS nodes_updated_at ON nodes;
CREATE TRIGGER nodes_updated_at BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS coordinates_updated_at ON coordinates;
CREATE TRIGGER coordinates_updated_at BEFORE UPDATE ON coordinates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
