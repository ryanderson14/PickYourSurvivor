import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { LeagueCard } from "@/components/league/league-card";
import { JoinLeagueDialog } from "@/components/league/join-league-dialog";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if user has username
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile?.username) redirect("/onboarding");

  // Get user's leagues with member count
  const { data: memberships, error: membershipsError } = await supabase
    .from("league_members")
    .select(
      `
      league_id,
      is_eliminated,
      eliminated_at_episode,
      leagues (
        id,
        name,
        invite_code,
        host_id,
        season,
        created_at
      )
    `
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (membershipsError) {
    console.error("[dashboard.league_members.select]", membershipsError);
  }

  // If the user is only in one league, skip the picker and go straight there.
  if (!membershipsError && memberships?.length === 1) {
    redirect(`/league/${memberships[0].league_id}`);
  }

  // Get current episode
  const { data: currentEpisode } = await supabase
    .from("episodes")
    .select("*")
    .eq("is_complete", false)
    .order("number")
    .limit(1)
    .single();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Your Leagues</h1>
            <p className="text-muted-foreground">
              Season 50{currentEpisode ? ` — Episode ${currentEpisode.number}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <JoinLeagueDialog />
          </div>
        </div>

        {membershipsError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            We couldn&apos;t load your league memberships due to a database policy
            error. Apply the latest Supabase migrations and refresh.
          </div>
        ) : !memberships || memberships.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-12 text-center">
            <p className="text-lg text-muted-foreground">
              You haven&apos;t joined any leagues yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Join a league with an invite link or enter a code above.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {memberships.map((m) => {
              const league = m.leagues as unknown as {
                id: string;
                name: string;
                invite_code: string;
                host_id: string | null;
                season: number;
              };
              return (
                <LeagueCard
                  key={league.id}
                  league={league}
                  isEliminated={m.is_eliminated}
                  eliminatedAtEpisode={m.eliminated_at_episode}
                  currentEpisode={currentEpisode?.number ?? null}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
