-- Fix recursive league_members SELECT policy and allow profile fallback inserts.
--
-- The old league_members_select policy queried league_members from inside itself,
-- which can fail with RLS recursion and surface as:
-- - "no leagues" on dashboard
-- - redirects away from /league/:id/picks
-- - "Failed to join league" when duplicate inserts happen

DROP POLICY IF EXISTS "league_members_select" ON league_members;

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

-- Safety net for users missing a profiles row.
-- The auth callback currently attempts an upsert; without this policy the
-- insert path is blocked by RLS.
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
