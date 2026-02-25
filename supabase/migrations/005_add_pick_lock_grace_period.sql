-- Picks now lock 10 minutes after airtime instead of exactly at airtime.
-- Keep policy names the same so app code and tooling remain unchanged.

DROP POLICY IF EXISTS "picks_select" ON picks;
DROP POLICY IF EXISTS "picks_insert" ON picks;
DROP POLICY IF EXISTS "picks_delete" ON picks;

CREATE POLICY "picks_select" ON picks
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = picks.episode_id
      AND episodes.air_date + interval '10 minutes' <= now()
    )
  );

CREATE POLICY "picks_insert" ON picks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = picks.episode_id
      AND episodes.air_date + interval '10 minutes' > now()
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
      AND episodes.air_date + interval '10 minutes' > now()
    )
  );
