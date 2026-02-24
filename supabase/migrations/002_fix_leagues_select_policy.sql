-- Fix leagues_select RLS policy
-- The previous policy only allowed league members to see leagues, which broke:
-- 1. Joining via invite code (can't find the league if you're not a member)
-- 2. Dashboard display (join from league_members to leagues was blocked)
--
-- League names are not sensitive; access is gated by the invite code.
-- Allow any authenticated user to read leagues.

DROP POLICY "leagues_select" ON leagues;


CREATE POLICY "leagues_select" ON leagues
  FOR SELECT USING (auth.uid() IS NOT NULL);
