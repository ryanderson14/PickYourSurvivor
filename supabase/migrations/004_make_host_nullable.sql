-- ============================================
-- Migration 004: DB-configured leagues
-- Leagues are now seeded by admins in the database rather than
-- created by users. host_id becomes nullable; user creation of
-- leagues is removed from the app surface.
-- ============================================

-- Make host_id nullable (seeded leagues have no owner)
ALTER TABLE leagues
  ALTER COLUMN host_id DROP NOT NULL;

-- Drop the user-facing league insert policy (leagues are admin-seeded only)
DROP POLICY IF EXISTS "leagues_insert" ON leagues;

-- Update the update policy to guard against null host_id
-- (NULL = no owner = nobody can update via RLS; admin uses service role)
DROP POLICY IF EXISTS "leagues_update" ON leagues;
CREATE POLICY "leagues_update" ON leagues
  FOR UPDATE USING (
    host_id IS NOT NULL AND auth.uid() = host_id
  );
