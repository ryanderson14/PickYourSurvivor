"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";

function logSupabaseError(context: string, error: PostgrestError) {
  console.error(`[${context}] ${error.message}`, {
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
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

