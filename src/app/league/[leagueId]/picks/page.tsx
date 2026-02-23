import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ContestantGrid } from "@/components/picks/contestant-grid";
import { CountdownTimer } from "@/components/picks/countdown-timer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import {
  getRequiredPicks,
  getAvailableContestants,
  arePicksLocked,
  getCurrentEpisode,
} from "@/lib/game-logic";
import type { Contestant, Episode, Pick } from "@/lib/types";

export default async function PicksPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify membership
  const { data: member } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) redirect("/dashboard");

  // Get league name
  const { data: league } = await supabase
    .from("leagues")
    .select("name")
    .eq("id", leagueId)
    .single();

  // Get episodes
  const { data: episodesData } = await supabase
    .from("episodes")
    .select("*")
    .order("number");

  const episodes = (episodesData ?? []) as Episode[];
  const currentEpisode = getCurrentEpisode(episodes);

  if (!currentEpisode) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-8 text-center">
          <p className="text-muted-foreground">Season is complete!</p>
        </main>
      </div>
    );
  }

  const locked = arePicksLocked(currentEpisode);

  // Get all contestants
  const { data: contestantsData } = await supabase
    .from("contestants")
    .select("*")
    .eq("season", 50)
    .order("tribe")
    .order("name");

  const allContestants = (contestantsData ?? []) as Contestant[];

  // Get all of this user's picks in this league
  const { data: picksData } = await supabase
    .from("picks")
    .select("*")
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  const allPicks = (picksData ?? []) as Pick[];

  // Current episode picks
  const currentPicks = allPicks.filter(
    (p) => p.episode_id === currentEpisode.id
  );

  // Calculate required picks
  const requiredPicks = getRequiredPicks(
    allPicks,
    episodes,
    currentEpisode.number
  );

  // Available contestants
  const available = getAvailableContestants(allContestants, allPicks);

  // For display, we want all contestants but mark which are available
  const usedContestantIds = new Set(allPicks.map((p) => p.contestant_id));
  // Remove current episode picks from "used" since they can be changed
  currentPicks.forEach((p) => usedContestantIds.delete(p.contestant_id));

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/league/${leagueId}`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {league?.name}
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                Episode {currentEpisode.number} Picks
              </h1>
              <p className="text-sm text-muted-foreground">
                {requiredPicks > 1
                  ? `You must pick ${requiredPicks} contestants (${requiredPicks - 1} missed week${requiredPicks > 2 ? "s" : ""})`
                  : "Pick one contestant to survive this episode"}
              </p>
            </div>
            <CountdownTimer airDate={currentEpisode.air_date} />
          </div>
        </div>

        {member.is_eliminated ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-lg text-muted-foreground">
                You have been eliminated from this league.
              </p>
            </CardContent>
          </Card>
        ) : locked ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-lg text-muted-foreground">
                Picks are locked for this episode.
              </p>
              {currentPicks.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Your picks have been submitted.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {requiredPicks > 1 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-orange-500/10 p-3 text-sm text-orange-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                You owe {requiredPicks} picks due to missed weeks. Select{" "}
                {requiredPicks} contestants.
              </div>
            )}
            <ContestantGrid
              contestants={allContestants}
              usedContestantIds={Array.from(usedContestantIds)}
              currentPickIds={currentPicks.map((p) => p.contestant_id)}
              requiredPicks={requiredPicks}
              leagueId={leagueId}
              episodeId={currentEpisode.id}
            />
          </>
        )}
      </main>
    </div>
  );
}
