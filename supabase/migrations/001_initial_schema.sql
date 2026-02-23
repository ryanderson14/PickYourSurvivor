-- ============================================
-- Pick Your Survivor — Database Schema
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Leagues
CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES profiles(id),
  season INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- League Members
CREATE TABLE league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  is_eliminated BOOLEAN DEFAULT false NOT NULL,
  eliminated_at_episode INT,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(league_id, user_id)
);

-- Contestants
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

-- Episodes
CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INT NOT NULL UNIQUE,
  title TEXT,
  air_date TIMESTAMPTZ NOT NULL,
  is_complete BOOLEAN DEFAULT false NOT NULL
);

-- Picks
CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  episode_id UUID NOT NULL REFERENCES episodes(id),
  contestant_id UUID NOT NULL REFERENCES contestants(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(league_id, user_id, contestant_id)
);

-- Indexes
CREATE INDEX idx_league_members_league ON league_members(league_id);
CREATE INDEX idx_league_members_user ON league_members(user_id);
CREATE INDEX idx_picks_league_episode ON picks(league_id, episode_id);
CREATE INDEX idx_picks_user ON picks(user_id);
CREATE INDEX idx_contestants_season ON contestants(season);
CREATE INDEX idx_episodes_number ON episodes(number);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, users update their own
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Leagues: members can read, anyone can create
CREATE POLICY "leagues_select" ON leagues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = leagues.id
      AND league_members.user_id = auth.uid()
    )
  );

CREATE POLICY "leagues_insert" ON leagues
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "leagues_update" ON leagues
  FOR UPDATE USING (auth.uid() = host_id);

-- League Members: members can see their league, anyone can join
CREATE POLICY "league_members_select" ON league_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_members lm
      WHERE lm.league_id = league_members.league_id
      AND lm.user_id = auth.uid()
    )
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

-- Contestants: anyone authenticated can read
CREATE POLICY "contestants_select" ON contestants
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Episodes: anyone authenticated can read
CREATE POLICY "episodes_select" ON episodes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Picks: own picks always visible, others visible after episode airs
CREATE POLICY "picks_select" ON picks
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = picks.episode_id
      AND episodes.air_date <= now()
    )
  );

-- Picks: can insert before episode airs, must be league member
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

-- Picks: can delete own picks before episode airs
CREATE POLICY "picks_delete" ON picks
  FOR DELETE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = picks.episode_id
      AND episodes.air_date > now()
    )
  );
