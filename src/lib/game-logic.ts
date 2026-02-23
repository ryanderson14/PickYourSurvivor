import type { Contestant, Episode, Pick } from "./types";
import { MAX_CONSECUTIVE_MISSES } from "./constants";

/**
 * Calculate how many picks a player must make this episode.
 * Base 1 + 1 for each past episode they missed.
 */
export function getRequiredPicks(
  allPicks: Pick[],
  episodes: Episode[],
  currentEpisodeNumber: number
): number {
  let missedWeeks = 0;
  for (let ep = 1; ep < currentEpisodeNumber; ep++) {
    const episode = episodes.find((e) => e.number === ep);
    if (!episode) continue;
    const picksForEp = allPicks.filter((p) => p.episode_id === episode.id);
    if (picksForEp.length === 0) missedWeeks++;
  }
  return 1 + missedWeeks;
}

/**
 * Count consecutive missed episodes going backwards from the current one.
 */
export function getConsecutiveMisses(
  allPicks: Pick[],
  episodes: Episode[],
  currentEpisodeNumber: number
): number {
  let consecutive = 0;
  for (let ep = currentEpisodeNumber - 1; ep >= 1; ep--) {
    const episode = episodes.find((e) => e.number === ep);
    if (!episode) continue;
    const picksForEp = allPicks.filter((p) => p.episode_id === episode.id);
    if (picksForEp.length === 0) {
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
 * Check if picks are locked for an episode (past air date).
 */
export function arePicksLocked(episode: Episode): boolean {
  return new Date(episode.air_date) <= new Date();
}

/**
 * Get time remaining until picks lock, in milliseconds.
 */
export function getTimeUntilLock(episode: Episode): number {
  return Math.max(0, new Date(episode.air_date).getTime() - Date.now());
}
