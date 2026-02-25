import type { Contestant, Episode, Pick } from "./types";
import { MAX_CONSECUTIVE_MISSES } from "./constants";

export const PICK_LOCK_GRACE_MINUTES = 10;
const PICK_LOCK_GRACE_MS = PICK_LOCK_GRACE_MINUTES * 60 * 1000;

/**
 * Calculate how many picks a player must make this episode.
 * Base 1 + 1 for each consecutive missed episode immediately before this one.
 */
export function getRequiredPicks(
  allPicks: Pick[],
  episodes: Episode[],
  currentEpisodeNumber: number
): number {
  return 1 + getConsecutiveMisses(allPicks, episodes, currentEpisodeNumber);
}

/**
 * Count consecutive missed episodes immediately before the current one.
 */
export function getConsecutiveMisses(
  allPicks: Pick[],
  episodes: Episode[],
  currentEpisodeNumber: number
): number {
  const pickedEpisodeIds = new Set(allPicks.map((p) => p.episode_id));
  let consecutive = 0;
  for (let ep = currentEpisodeNumber - 1; ep >= 1; ep--) {
    const episode = episodes.find((e) => e.number === ep);
    if (!episode) continue;
    if (!pickedEpisodeIds.has(episode.id)) {
      consecutive++;
    } else {
      break;
    }
  }
  return consecutive;
}

/**
 * Should this player be auto-eliminated for missing too many weeks?
 */
export function shouldAutoEliminate(
  allPicks: Pick[],
  episodes: Episode[],
  currentEpisodeNumber: number
): boolean {
  return (
    getConsecutiveMisses(allPicks, episodes, currentEpisodeNumber) >=
    MAX_CONSECUTIVE_MISSES
  );
}

/**
 * Get contestants that are still available for a player to pick.
 * Filters out: eliminated contestants + already-picked contestants.
 */
export function getAvailableContestants(
  allContestants: Contestant[],
  memberPicks: Pick[]
): Contestant[] {
  const usedIds = new Set(memberPicks.map((p) => p.contestant_id));
  return allContestants.filter((c) => !c.is_eliminated && !usedIds.has(c.id));
}

/**
 * Get the current episode (next one that hasn't been completed).
 */
export function getCurrentEpisode(episodes: Episode[]): Episode | null {
  const sorted = [...episodes].sort((a, b) => a.number - b.number);
  return sorted.find((e) => !e.is_complete) ?? null;
}

/**
 * Get the exact lock timestamp for an episode air date.
 * Picks lock 10 minutes after airtime.
 */
export function getPickLockDate(airDate: string): Date {
  return new Date(new Date(airDate).getTime() + PICK_LOCK_GRACE_MS);
}

/**
 * Check if picks are locked for a given episode air date.
 */
export function arePicksLockedByAirDate(airDate: string): boolean {
  return getPickLockDate(airDate).getTime() <= Date.now();
}

/**
 * Check if picks are locked for an episode.
 */
export function arePicksLocked(episode: Episode): boolean {
  return arePicksLockedByAirDate(episode.air_date);
}

/**
 * Get time remaining until picks lock for a given episode air date, in milliseconds.
 */
export function getTimeUntilLockByAirDate(airDate: string): number {
  return Math.max(0, getPickLockDate(airDate).getTime() - Date.now());
}

/**
 * Get time remaining until picks lock, in milliseconds.
 */
export function getTimeUntilLock(episode: Episode): number {
  return getTimeUntilLockByAirDate(episode.air_date);
}
