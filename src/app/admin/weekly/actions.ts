"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MAX_CONSECUTIVE_MISSES } from "@/lib/constants";
import { arePicksLockedByAirDate } from "@/lib/game-logic";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OWNER_UNLOCK_COOKIE,
  createOwnerUnlockCookie,
  hasOwnerSecretConfigured,
  isOwnerByIdentity,
  isOwnerSecretValid,
  isOwnerUnlockedByCookie,
} from "@/lib/owner-access";

function adminUrl(status: "success" | "error", message: string): string {
  return `/admin/weekly?status=${status}&message=${encodeURIComponent(message)}`;
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function requireOwnerAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/weekly");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const cookieStore = await cookies();
  const unlockedBySecret = isOwnerUnlockedByCookie(
    cookieStore.get(OWNER_UNLOCK_COOKIE)?.value ?? null
  );
  const allowedByIdentity = isOwnerByIdentity({
    email: user.email ?? null,
    username: profile?.username ?? null,
  });

  if (!allowedByIdentity && !unlockedBySecret) {
    redirect(adminUrl("error", "You are not allowed to run weekly updates."));
  }
}

async function applyConsecutiveMissEliminations(
  admin: AdminClient,
  episodeNumber: number
): Promise<number> {
  const { data: activeMembers, error: activeMembersError } = await admin
    .from("league_members")
    .select("league_id, user_id")
    .eq("is_eliminated", false);

  if (activeMembersError) {
    throw new Error(activeMembersError.message);
  }

  const leaguesToUsers = new Map<string, string[]>();
  for (const member of activeMembers ?? []) {
    if (!leaguesToUsers.has(member.league_id)) {
      leaguesToUsers.set(member.league_id, []);
    }
    leaguesToUsers.get(member.league_id)!.push(member.user_id);
  }

  if (leaguesToUsers.size === 0) return 0;

  const { data: episodes, error: episodesError } = await admin
    .from("episodes")
    .select("id, number")
    .lte("number", episodeNumber)
    .order("number", { ascending: true });

  if (episodesError) {
    throw new Error(episodesError.message);
  }

  const orderedEpisodeIds = (episodes ?? []).map((ep) => ep.id);
  if (orderedEpisodeIds.length === 0) return 0;

  let totalMissEliminated = 0;

  for (const [leagueId, userIds] of leaguesToUsers.entries()) {
    const { data: picks, error: picksError } = await admin
      .from("picks")
      .select("user_id, episode_id")
      .eq("league_id", leagueId)
      .in("user_id", userIds);

    if (picksError) {
      throw new Error(picksError.message);
    }

    const pickedEpisodesByUser = new Map<string, Set<string>>();
    for (const pick of picks ?? []) {
      if (!pickedEpisodesByUser.has(pick.user_id)) {
        pickedEpisodesByUser.set(pick.user_id, new Set());
      }
      pickedEpisodesByUser.get(pick.user_id)!.add(pick.episode_id);
    }

    const toEliminate: string[] = [];
    for (const userId of userIds) {
      const pickedEpisodes = pickedEpisodesByUser.get(userId) ?? new Set<string>();
      let misses = 0;

      for (let idx = orderedEpisodeIds.length - 1; idx >= 0; idx -= 1) {
        if (pickedEpisodes.has(orderedEpisodeIds[idx])) {
          break;
        }
        misses += 1;
      }

      if (misses >= MAX_CONSECUTIVE_MISSES) {
        toEliminate.push(userId);
      }
    }

    if (toEliminate.length === 0) continue;

    const { data: updatedMembers, error: updateError } = await admin
      .from("league_members")
      .update({
        is_eliminated: true,
        eliminated_at_episode: episodeNumber,
      })
      .eq("league_id", leagueId)
      .eq("is_eliminated", false)
      .in("user_id", toEliminate)
      .select("id");

    if (updateError) {
      throw new Error(updateError.message);
    }

    totalMissEliminated += updatedMembers?.length ?? 0;
  }

  return totalMissEliminated;
}

export async function unlockWeeklyAdmin(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/weekly");
  }

  if (!hasOwnerSecretConfigured()) {
    redirect(
      adminUrl(
        "error",
        "Owner secret is not configured. Set OWNER_SECRET_PASSWORD."
      )
    );
  }

  const password = String(formData.get("owner_password") ?? "");
  if (!isOwnerSecretValid(password)) {
    redirect(adminUrl("error", "Incorrect owner password."));
  }

  const cookieValue = createOwnerUnlockCookie();
  if (!cookieValue) {
    redirect(adminUrl("error", "Owner secret is unavailable."));
  }

  const cookieStore = await cookies();
  cookieStore.set(OWNER_UNLOCK_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect(adminUrl("success", "Owner tools unlocked."));
}

export async function lockWeeklyAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(OWNER_UNLOCK_COOKIE);
  redirect(adminUrl("success", "Owner tools locked."));
}

export async function publishWeeklyUpdate(formData: FormData) {
  await requireOwnerAccess();

  const episodeId = String(formData.get("episode_id") ?? "");
  if (!episodeId) {
    redirect(adminUrl("error", "Missing episode context. Refresh and try again."));
  }

  const eliminatedIds = Array.from(
    new Set(
      formData
        .getAll("eliminated_ids")
        .map((id) => String(id))
        .filter(Boolean)
    )
  );

  if (eliminatedIds.length === 0) {
    redirect(adminUrl("error", "Select at least one voted-out contestant."));
  }

  const admin = createAdminClient();

  const { data: episode, error: episodeError } = await admin
    .from("episodes")
    .select("id, number, air_date")
    .eq("id", episodeId)
    .eq("is_complete", false)
    .maybeSingle();

  if (episodeError) {
    redirect(adminUrl("error", `Could not load episode: ${episodeError.message}`));
  }

  if (!episode) {
    redirect(adminUrl("error", "Episode already completed or unavailable."));
  }

  if (!arePicksLockedByAirDate(episode.air_date)) {
    redirect(adminUrl("error", "Cannot close an episode before picks lock."));
  }

  const { data: chosenContestants, error: contestantsError } = await admin
    .from("contestants")
    .select("id, name, is_eliminated")
    .in("id", eliminatedIds);

  if (contestantsError) {
    redirect(
      adminUrl("error", `Could not validate contestants: ${contestantsError.message}`)
    );
  }

  if (!chosenContestants || chosenContestants.length !== eliminatedIds.length) {
    redirect(adminUrl("error", "One or more contestants are invalid."));
  }

  const alreadyOut = chosenContestants.find((c) => c.is_eliminated);
  if (alreadyOut) {
    redirect(adminUrl("error", `${alreadyOut.name} is already marked eliminated.`));
  }

  const { error: contestantsUpdateError } = await admin
    .from("contestants")
    .update({
      is_eliminated: true,
      eliminated_at_episode: episode.number,
    })
    .in("id", eliminatedIds);

  if (contestantsUpdateError) {
    redirect(
      adminUrl(
        "error",
        `Could not save contestant eliminations: ${contestantsUpdateError.message}`
      )
    );
  }

  const { data: badPicks, error: badPicksError } = await admin
    .from("picks")
    .select("league_id, user_id")
    .eq("episode_id", episode.id)
    .in("contestant_id", eliminatedIds);

  if (badPicksError) {
    redirect(adminUrl("error", `Could not load picks: ${badPicksError.message}`));
  }

  const badByLeague = new Map<string, Set<string>>();
  for (const pick of badPicks ?? []) {
    if (!badByLeague.has(pick.league_id)) {
      badByLeague.set(pick.league_id, new Set());
    }
    badByLeague.get(pick.league_id)!.add(pick.user_id);
  }

  let eliminatedByVoteCount = 0;
  for (const [leagueId, users] of badByLeague.entries()) {
    const userIds = [...users];
    if (userIds.length === 0) continue;

    const { data: updatedMembers, error: memberUpdateError } = await admin
      .from("league_members")
      .update({
        is_eliminated: true,
        eliminated_at_episode: episode.number,
      })
      .eq("league_id", leagueId)
      .eq("is_eliminated", false)
      .in("user_id", userIds)
      .select("id");

    if (memberUpdateError) {
      redirect(
        adminUrl(
          "error",
          `Could not eliminate picked players: ${memberUpdateError.message}`
        )
      );
    }

    eliminatedByVoteCount += updatedMembers?.length ?? 0;
  }

  const { error: markCompleteError } = await admin
    .from("episodes")
    .update({ is_complete: true })
    .eq("id", episode.id);

  if (markCompleteError) {
    redirect(
      adminUrl("error", `Could not mark episode complete: ${markCompleteError.message}`)
    );
  }

  let eliminatedByMissCount = 0;
  try {
    eliminatedByMissCount = await applyConsecutiveMissEliminations(
      admin,
      episode.number
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown miss-elimination error";
    redirect(adminUrl("error", `Episode completed, but misses failed: ${message}`));
  }

  const eliminatedNames = chosenContestants
    .map((contestant) => contestant.name)
    .sort((a, b) => a.localeCompare(b));

  revalidatePath("/dashboard");
  revalidatePath("/admin/weekly");

  const totalEliminatedPlayers = eliminatedByVoteCount + eliminatedByMissCount;
  redirect(
    adminUrl(
      "success",
      `Episode ${episode.number} saved. Out: ${eliminatedNames.join(", ")}. Eliminated players: ${totalEliminatedPlayers}.`
    )
  );
}
