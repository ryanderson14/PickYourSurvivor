import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { StandingsTable } from "@/components/league/standings-table";
import type { MemberWithStats } from "@/components/league/standings-table";
import { EpisodePickSection } from "@/components/league/episode-pick-section";
import { Card, CardContent } from "@/components/ui/card";
import { Crown, Trophy } from "lucide-react";
import { CopyButton } from "@/components/league/copy-button";
import {
  getRequiredPicks,
  arePicksLocked,
  getCurrentEpisode,
} from "@/lib/game-logic";
import { SEASON } from "@/lib/constants";
import type { Contestant, Episode, Pick as UserPick } from "@/lib/types";

export default async function LeaguePage({
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

  // Fetch all data in parallel
  const [
    { data: league },
    { data: members },
    { data: episodesData },
    { data: contestantsData },
    { data: userPicksData },
    { data: allLeaguePicksData },
  ] = await Promise.all([
    supabase.from("leagues").select("*").eq("id", leagueId).single(),
    supabase
      .from("league_members")
      .select(
        `
        *,
        profile:profiles (
          id,
          username,
          avatar_url
        )
      `
      )
      .eq("league_id", leagueId)
      .order("is_eliminated")
      .order("joined_at"),
    supabase.from("episodes").select("*").order("number"),
    supabase
      .from("contestants")
      .select("*")
      .eq("season", SEASON)
      .order("name"),
    supabase
      .from("picks")
      .select("*, contestant:contestants(name, tribe, tribe_color, image_url, is_eliminated, eliminated_at_episode)")
      .eq("league_id", leagueId)
      .eq("user_id", user.id),
    supabase
      .from("picks")
      .select("*, contestant:contestants(name, tribe, tribe_color, image_url, is_eliminated, eliminated_at_episode), episode:episodes(number, is_complete)")
      .eq("league_id", leagueId),
  ]);

  if (!league) redirect("/dashboard");

  const episodes = (episodesData ?? []) as Episode[];
  const allContestants = (contestantsData ?? []) as Contestant[];
  const userPicks = (userPicksData ?? []) as UserPick[];
  const allLeaguePicks = (allLeaguePicksData ?? []) as (UserPick & {
    contestant: Contestant | null;
    episode: Episode | null;
  })[];

  const currentEpisode = getCurrentEpisode(episodes);
  const currentMember = members?.find((m) => m.user_id === user.id);
  const isHost = league.host_id === user.id;

  // Completed episodes (for pick history)
  const completedEpisodes = episodes
    .filter((e) => e.is_complete)
    .sort((a, b) => a.number - b.number);

  // Current episode picks
  const currentUserPicks = currentEpisode
    ? userPicks.filter((p) => p.episode_id === currentEpisode.id)
    : [];

  // Used contestant IDs (across all episodes, excluding current episode picks)
  const usedContestantIds = userPicks
    .filter((p) => !currentEpisode || p.episode_id !== currentEpisode.id)
    .map((p) => p.contestant_id);

  // Required picks
  const requiredPicks = currentEpisode
    ? getRequiredPicks(userPicks, episodes, currentEpisode.number)
    : 1;

  const locked = currentEpisode ? arePicksLocked(currentEpisode) : true;
  const isUserEliminated = currentMember?.is_eliminated ?? false;
  const seasonComplete = !currentEpisode;

  // Winner check
  const activeMembersCount =
    members?.filter((m) => !m.is_eliminated).length ?? 0;
  const winner =
    activeMembersCount === 1 ? members?.find((m) => !m.is_eliminated) : null;

  // Build pick status for episode banner
  const pickStatus = (() => {
    if (isUserEliminated) return { kind: "eliminated" as const };
    if (locked) return { kind: "locked" as const };
    if (currentUserPicks.length >= requiredPicks && currentUserPicks.length > 0) {
      return {
        kind: "picked" as const,
        contestants: currentUserPicks
          .filter((p) => p.contestant)
          .map((p) => p.contestant as Pick<Contestant, "name" | "image_url" | "tribe">),
      };
    }
    if (requiredPicks > 1 && currentUserPicks.length > 0) {
      return {
        kind: "debt" as const,
        required: requiredPicks,
        picked: currentUserPicks.length,
      };
    }
    if (requiredPicks > 1) {
      return {
        kind: "debt" as const,
        required: requiredPicks,
        picked: 0,
      };
    }
    return { kind: "pick-below" as const };
  })();

  // Build pick history for each member
  const membersWithStats: MemberWithStats[] = (members ?? []).map((m) => {
    const memberPicks = allLeaguePicks.filter((p) => p.user_id === m.user_id);
    const memberUsedIds = new Set(memberPicks.map((p) => p.contestant_id));
    const available = allContestants.filter(
      (c) => !c.is_eliminated && !memberUsedIds.has(c.id)
    ).length;

    // Build pick history from completed episodes (supports multiple picks per episode)
    const pickHistory = completedEpisodes.flatMap((ep) => {
      const episodePicks = memberPicks.filter(
        (p) => p.episode && (p.episode as Episode).number === ep.number
      );

      if (episodePicks.length === 0) {
        return [
          {
            episodeNumber: ep.number,
            contestant: null as Pick<Contestant, "name" | "image_url" | "tribe"> | null,
            survived: false,
            missed: true,
          },
        ];
      }

      return episodePicks.map((pick) => {
        const contestant = pick.contestant as Contestant;
        const wasEliminated = contestant.eliminated_at_episode === ep.number;
        return {
          episodeNumber: ep.number,
          contestant: {
            name: contestant.name,
            image_url: contestant.image_url,
            tribe: contestant.tribe,
          },
          survived: !wasEliminated,
          missed: false,
        };
      });
    });

    return {
      user_id: m.user_id,
      is_eliminated: m.is_eliminated,
      eliminated_at_episode: m.eliminated_at_episode,
      picksUsed: memberPicks.length,
      availableContestants: available,
      profile: m.profile as { id: string; username: string; avatar_url: string | null },
      pickHistory,
    };
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* League Header */}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {league.name}
            {isHost && <Crown className="h-5 w-5 text-yellow-500" />}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span>Season {league.season}</span>
            <span>{members?.length ?? 0} players</span>
            <div className="flex items-center gap-1">
              <span>Code: {league.invite_code}</span>
              <CopyButton text={league.invite_code} />
            </div>
          </div>
        </div>

        {/* Winner Banner */}
        {winner && (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="flex items-center gap-3 p-5">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="font-semibold text-yellow-400">
                  {(winner.profile as { username: string }).username} wins!
                </p>
                <p className="text-sm text-muted-foreground">
                  Last player standing
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Episode Banner + Collapsible Contestant Grid */}
        {currentEpisode && (
          <EpisodePickSection
            episode={currentEpisode}
            pickStatus={pickStatus}
            contestants={allContestants}
            usedContestantIds={usedContestantIds}
            currentPickIds={currentUserPicks.map((p) => p.contestant_id)}
            requiredPicks={requiredPicks}
            leagueId={leagueId}
            isLocked={locked}
            isEliminated={isUserEliminated}
          />
        )}

        {/* Season Complete */}
        {seasonComplete && !winner && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                Season Complete
              </p>
            </CardContent>
          </Card>
        )}

        {/* Standings + Pick History */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">Standings</h2>
          <StandingsTable
            members={membersWithStats}
            currentUserId={user.id}
          />
        </section>
      </main>
    </div>
  );
}
