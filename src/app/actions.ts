"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import type { PostgrestError } from "@supabase/supabase-js";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function logSupabaseError(context: string, error: PostgrestError) {
  console.error(`[${context}] ${error.message}`, {
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export async function createLeague(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const name = (formData.get("name") as string)?.trim();
  if (!name || name.length < 2) {
    return { error: "League name must be at least 2 characters" };
  }

  const leagueId = randomUUID();

  // Retry on invite-code collisions. This keeps create-league robust even
  // with the unique constraint on invite_code.
  let leagueCreated = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateInviteCode();
    const { error: leagueError } = await supabase
      .from("leagues")
      .insert({ id: leagueId, name, invite_code: inviteCode, host_id: user.id });

    if (!leagueError) {
      leagueCreated = true;
      break;
    }

    // Unique violation could be invite_code collision; retry a few times.
    if (leagueError.code === "23505") {
      continue;
    }

    logSupabaseError("createLeague.leagues.insert", leagueError);
    if (leagueError.code === "23503") {
      return { error: "Profile setup is incomplete. Sign out and sign in again." };
    }
    return { error: "Failed to create league. Try again." };
  }

  if (!leagueCreated) {
    return { error: "Could not generate a unique invite code. Try again." };
  }

  // Auto-join the host as a member
  const { error: memberError } = await supabase
    .from("league_members")
    .insert({ league_id: leagueId, user_id: user.id });

  if (memberError && memberError.code !== "23505") {
    logSupabaseError("createLeague.league_members.insert", memberError);
    return {
      error:
        "League was created, but membership failed. Apply latest Supabase migrations, then try creating the league again.",
    };
  }

  revalidatePath("/dashboard");
  redirect(`/league/${leagueId}`);
}

export async function joinLeague(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const code = (formData.get("code") as string)?.trim().toUpperCase();
  if (!code || code.length !== 6) {
    return { error: "Enter a 6-character invite code" };
  }

  // Find the league
  const { data: league, error: leagueLookupError } = await supabase
    .from("leagues")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle();

  if (leagueLookupError) {
    logSupabaseError("joinLeague.leagues.lookup", leagueLookupError);
    return { error: "Could not look up that league right now. Try again." };
  }

  if (!league) {
    return { error: "Invalid invite code" };
  }

  // Check if already a member
  const { data: existing, error: existingError } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    logSupabaseError("joinLeague.league_members.existing", existingError);
    return {
      error:
        "Could not verify membership due to a database policy issue. Apply latest Supabase migrations and try again.",
    };
  }

  if (existing) {
    redirect(`/league/${league.id}`);
  }

  const { error } = await supabase
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id });

  if (error) {
    if (error.code === "23505") {
      redirect(`/league/${league.id}`);
    }
    if (error.code === "23503") {
      return { error: "Profile setup is incomplete. Sign out and sign in again." };
    }
    logSupabaseError("joinLeague.league_members.insert", error);
    return { error: "Failed to join league. Try again." };
  }

  revalidatePath("/dashboard");
  redirect(`/league/${league.id}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function submitPicks(
  leagueId: string,
  episodeId: string,
  contestantIds: string[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (contestantIds.length === 0) {
    return { error: "Select at least one contestant" };
  }

  // Verify episode is still open
  const { data: episode } = await supabase
    .from("episodes")
    .select("air_date")
    .eq("id", episodeId)
    .single();

  if (!episode || new Date(episode.air_date) <= new Date()) {
    return { error: "Picks are locked for this episode" };
  }

  // Delete any existing picks for this episode (in case of re-pick)
  await supabase
    .from("picks")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .eq("episode_id", episodeId);

  // Insert new picks
  const picks = contestantIds.map((contestant_id) => ({
    league_id: leagueId,
    user_id: user.id,
    episode_id: episodeId,
    contestant_id,
  }));

  const { error } = await supabase.from("picks").insert(picks);

  if (error) {
    if (error.code === "23505") {
      return { error: "You already used one of these contestants this season" };
    }
    return { error: "Failed to submit picks. Try again." };
  }

  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}

export async function recordEpisodeResults(
  episodeId: string,
  eliminatedContestantIds: string[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get the episode
  const { data: episode } = await supabase
    .from("episodes")
    .select("number")
    .eq("id", episodeId)
    .single();

  if (!episode) return { error: "Episode not found" };

  // Mark contestants as eliminated
  for (const contestantId of eliminatedContestantIds) {
    await supabase
      .from("contestants")
      .update({
        is_eliminated: true,
        eliminated_at_episode: episode.number,
      })
      .eq("id", contestantId);
  }

  // Mark episode as complete
  await supabase
    .from("episodes")
    .update({ is_complete: true })
    .eq("id", episodeId);

  // Get all leagues to cascade eliminations
  const { data: allLeagues } = await supabase
    .from("leagues")
    .select("id");

  if (!allLeagues) return { error: "Failed to process results" };

  for (const league of allLeagues) {
    // Find members who picked eliminated contestants this episode
    const { data: badPicks } = await supabase
      .from("picks")
      .select("user_id")
      .eq("league_id", league.id)
      .eq("episode_id", episodeId)
      .in("contestant_id", eliminatedContestantIds);

    if (badPicks && badPicks.length > 0) {
      const userIds = [...new Set(badPicks.map((p) => p.user_id))];
      for (const userId of userIds) {
        await supabase
          .from("league_members")
          .update({
            is_eliminated: true,
            eliminated_at_episode: episode.number,
          })
          .eq("league_id", league.id)
          .eq("user_id", userId)
          .eq("is_eliminated", false);
      }
    }

    // Check for auto-elimination (3 consecutive missed weeks)
    const { data: members } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", league.id)
      .eq("is_eliminated", false);

    if (!members) continue;

    const { data: episodes } = await supabase
      .from("episodes")
      .select("id, number")
      .order("number");

    if (!episodes) continue;

    for (const member of members) {
      const { data: memberPicks } = await supabase
        .from("picks")
        .select("episode_id")
        .eq("league_id", league.id)
        .eq("user_id", member.user_id);

      // Check consecutive misses
      let consecutive = 0;
      for (let ep = episode.number; ep >= 1; ep--) {
        const epData = episodes.find((e) => e.number === ep);
        if (!epData) continue;
        const hasPick = memberPicks?.some((p) => p.episode_id === epData.id);
        if (!hasPick) {
          consecutive++;
        } else {
          break;
        }
      }

      if (consecutive >= 3) {
        await supabase
          .from("league_members")
          .update({
            is_eliminated: true,
            eliminated_at_episode: episode.number,
          })
          .eq("league_id", league.id)
          .eq("user_id", member.user_id);
      }

      // Check if member has any remaining available contestants
      const { data: allContestants } = await supabase
        .from("contestants")
        .select("id")
        .eq("is_eliminated", false)
        .eq("season", 50);

      const { data: allMemberPicks } = await supabase
        .from("picks")
        .select("contestant_id")
        .eq("league_id", league.id)
        .eq("user_id", member.user_id);

      if (allContestants && allMemberPicks) {
        const usedIds = new Set(allMemberPicks.map((p) => p.contestant_id));
        const available = allContestants.filter((c) => !usedIds.has(c.id));
        if (available.length === 0) {
          await supabase
            .from("league_members")
            .update({
              is_eliminated: true,
              eliminated_at_episode: episode.number,
            })
            .eq("league_id", league.id)
            .eq("user_id", member.user_id)
            .eq("is_eliminated", false);
        }
      }
    }
  }

  revalidatePath("/league");
  return { success: true };
}
