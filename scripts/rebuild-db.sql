-- ============================================
-- Pick Your Survivor — Full DB Rebuild (Idempotent)
-- Paste this entire file into the Supabase SQL Editor to rebuild from scratch.
-- Safe to run multiple times — uses DROP IF EXISTS / CREATE IF NOT EXISTS.
-- ============================================

-- 1. Drop everything in dependency order
DROP POLICY IF EXISTS "picks_delete" ON picks;
DROP POLICY IF EXISTS "picks_insert" ON picks;
DROP POLICY IF EXISTS "picks_select" ON picks;
DROP POLICY IF EXISTS "episodes_select" ON episodes;
DROP POLICY IF EXISTS "contestants_select" ON contestants;
DROP POLICY IF EXISTS "league_members_update" ON league_members;
DROP POLICY IF EXISTS "league_members_insert" ON league_members;
DROP POLICY IF EXISTS "league_members_select" ON league_members;
DROP POLICY IF EXISTS "leagues_update" ON leagues;
DROP POLICY IF EXISTS "leagues_insert" ON leagues;
DROP POLICY IF EXISTS "leagues_select" ON leagues;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;

DROP TABLE IF EXISTS picks CASCADE;
DROP TABLE IF EXISTS league_members CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;
DROP TABLE IF EXISTS contestants CASCADE;
DROP TABLE IF EXISTS episodes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS public.is_member_of_league(UUID);

-- 2. Create tables (from migration 001)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES profiles(id),  -- nullable per migration 004
  season INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  is_eliminated BOOLEAN DEFAULT false NOT NULL,
  eliminated_at_episode INT,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(league_id, user_id)
);

CREATE TABLE contestants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tribe TEXT NOT NULL,
  tribe_color TEXT NOT NULL,
  image_url TEXT,
  season INT NOT NULL DEFAULT 50,
  is_eliminated BOOLEAN DEFAULT false NOT NULL,
  eliminated_at_episode INT
);

CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INT NOT NULL UNIQUE,
  title TEXT,
  air_date TIMESTAMPTZ NOT NULL,
  is_complete BOOLEAN DEFAULT false NOT NULL
);

CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  episode_id UUID NOT NULL REFERENCES episodes(id),
  contestant_id UUID NOT NULL REFERENCES contestants(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(league_id, user_id, contestant_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_league_members_league ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_league_episode ON picks(league_id, episode_id);
CREATE INDEX IF NOT EXISTS idx_picks_user ON picks(user_id);
CREATE INDEX IF NOT EXISTS idx_contestants_season ON contestants(season);
CREATE INDEX IF NOT EXISTS idx_episodes_number ON episodes(number);

-- 4. RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Leagues (migration 002: any auth'd user can read; migration 004: no insert policy)
CREATE POLICY "leagues_select" ON leagues
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "leagues_update" ON leagues
  FOR UPDATE USING (host_id IS NOT NULL AND auth.uid() = host_id);

-- League Members (migration 003: SECURITY DEFINER helper to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_member_of_league(target_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_members
    WHERE league_id = target_league_id
      AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_member_of_league(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_of_league(UUID) TO authenticated;

CREATE POLICY "league_members_select" ON league_members
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND public.is_member_of_league(league_id)
  );
CREATE POLICY "league_members_insert" ON league_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "league_members_update" ON league_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = league_members.league_id
      AND leagues.host_id = auth.uid()
    )
  );

-- Contestants & Episodes
CREATE POLICY "contestants_select" ON contestants
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "episodes_select" ON episodes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Picks
CREATE POLICY "picks_select" ON picks
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = picks.episode_id
      AND episodes.air_date <= now()
    )
  );
CREATE POLICY "picks_insert" ON picks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = picks.episode_id
      AND episodes.air_date > now()
    )
    AND EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = picks.league_id
      AND league_members.user_id = auth.uid()
      AND league_members.is_eliminated = false
    )
  );
CREATE POLICY "picks_delete" ON picks
  FOR DELETE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = picks.episode_id
      AND episodes.air_date > now()
    )
  );

-- 5. Seed data
INSERT INTO leagues (id, name, invite_code, season) VALUES
  ('00000000-0000-0000-0000-000000000050', 'Pick Your Survivor S50', 'PVRS50', 50);

INSERT INTO episodes (number, title, air_date) VALUES
  (1,  'Premiere',    '2026-02-25T20:00:00-05:00'),
  (2,  'Episode 2',   '2026-03-04T20:00:00-05:00'),
  (3,  'Episode 3',   '2026-03-11T20:00:00-04:00'),
  (4,  'Episode 4',   '2026-03-18T20:00:00-04:00'),
  (5,  'Episode 5',   '2026-03-25T20:00:00-04:00'),
  (6,  'Episode 6',   '2026-04-01T20:00:00-04:00'),
  (7,  'Episode 7',   '2026-04-08T20:00:00-04:00'),
  (8,  'Episode 8',   '2026-04-15T20:00:00-04:00'),
  (9,  'Episode 9',   '2026-04-22T20:00:00-04:00'),
  (10, 'Episode 10',  '2026-04-29T20:00:00-04:00'),
  (11, 'Episode 11',  '2026-05-06T20:00:00-04:00'),
  (12, 'Episode 12',  '2026-05-13T20:00:00-04:00'),
  (13, 'Finale',      '2026-05-20T20:00:00-04:00');

INSERT INTO contestants (name, tribe, tribe_color, season) VALUES
  ('Colby Donaldson',       'Vatu', 'blue',   50),
  ('Genevieve Mushaluk',    'Vatu', 'blue',   50),
  ('Rizo Velovic',          'Vatu', 'blue',   50),
  ('Angelina Keeley',       'Vatu', 'blue',   50),
  ('Q Burdette',            'Vatu', 'blue',   50),
  ('Stephenie LaGrossa',    'Vatu', 'blue',   50),
  ('Kyle Fraser',           'Vatu', 'blue',   50),
  ('Aubry Bracco',          'Vatu', 'blue',   50);

INSERT INTO contestants (name, tribe, tribe_color, season) VALUES
  ('Joe Hunter',            'Cila', 'orange', 50),
  ('Savannah Louie',        'Cila', 'orange', 50),
  ('Christian Hubicki',     'Cila', 'orange', 50),
  ('Cirie Fields',          'Cila', 'orange', 50),
  ('Ozzy Lusth',            'Cila', 'orange', 50),
  ('Emily Flippen',         'Cila', 'orange', 50),
  ('Rick Devens',           'Cila', 'orange', 50),
  ('Jenna Lewis-Dougherty', 'Cila', 'orange', 50);

INSERT INTO contestants (name, tribe, tribe_color, season) VALUES
  ('Jonathan Young',        'Kalo', 'purple', 50),
  ('Dee Valladares',        'Kalo', 'purple', 50),
  ('Mike White',            'Kalo', 'purple', 50),
  ('Kamilla Karthigesu',    'Kalo', 'purple', 50),
  ('Charlie Davis',         'Kalo', 'purple', 50),
  ('Tiffany Ervin',         'Kalo', 'purple', 50),
  ('Coach Wade',            'Kalo', 'purple', 50),
  ('Chrissy Hofbeck',       'Kalo', 'purple', 50);
