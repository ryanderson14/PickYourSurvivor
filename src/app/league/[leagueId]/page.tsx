import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { StandingsTable } from "@/components/league/standings-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Settings, Clock } from "lucide-react";
import { CopyButton } from "@/components/league/copy-button";
import { CountdownTimer } from "@/components/picks/countdown-timer";

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

  // Get league
  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (!league) redirect("/dashboard");

  // Get members with profiles
  const { data: members } = await supabase
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
    .order("joined_at");

  // Get current episode
  const { data: currentEpisode } = await supabase
    .from("episodes")
    .select("*")
    .eq("is_complete", false)
    .order("number")
    .limit(1)
    .single();

  // Get all picks for this league
  const { data: allPicks } = await supabase
    .from("picks")
    .select("*, contestant:contestants(name, tribe, tribe_color)")
    .eq("league_id", leagueId);

  // Current user's membership
  const currentMember = members?.find((m) => m.user_id === user.id);
  const isHost = league.host_id === user.id;

  // Check if current user has picked for current episode
  const currentUserPicks = allPicks?.filter(
    (p) => p.user_id === user.id && p.episode_id === currentEpisode?.id
  );
  const hasPicked = currentUserPicks && currentUserPicks.length > 0;

  // Count available contestants for each member
  const { data: contestants } = await supabase
    .from("contestants")
    .select("id")
    .eq("season", 50)
    .eq("is_eliminated", false);

  const membersWithStats = members?.map((m) => {
    const memberPicks = allPicks?.filter((p) => p.user_id === m.user_id) ?? [];
    const usedIds = new Set(memberPicks.map((p) => p.contestant_id));
    const available = contestants?.filter((c) => !usedIds.has(c.id)).length ?? 0;
    return { ...m, picksUsed: memberPicks.length, availableContestants: available };
  });

  // Check for a winner
  const activeMembersCount = members?.filter((m) => !m.is_eliminated).length ?? 0;
  const winner =
    activeMembersCount === 1
      ? members?.find((m) => !m.is_eliminated)
      : null;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* League Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
            <div className="flex gap-2">
              {isHost && (
                <Link href={`/league/${leagueId}/admin`}>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Settings className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Winner Banner */}
        {winner && (
          <Card className="mb-6 border-primary bg-primary/10">
            <CardContent className="flex items-center gap-3 p-5">
              <span className="text-3xl">🏆</span>
              <div>
                <p className="font-semibold text-primary">
                  {(winner.profile as { username: string }).username} wins!
                </p>
                <p className="text-sm text-muted-foreground">
                  Last player standing
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Standings</CardTitle>
              </CardHeader>
              <CardContent>
                <StandingsTable members={membersWithStats ?? []} currentUserId={user.id} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Current Episode */}
            {currentEpisode && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Episode {currentEpisode.number}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CountdownTimer airDate={currentEpisode.air_date} />
                  {!currentMember?.is_eliminated && (
                    <Link href={`/league/${leagueId}/picks`}>
                      <Button
                        className="w-full"
                        variant={hasPicked ? "outline" : "default"}
                      >
                        {hasPicked ? "Change Picks" : "Make Your Pick"}
                      </Button>
                    </Link>
                  )}
                  {hasPicked && currentUserPicks && (
                    <div className="text-sm text-muted-foreground">
                      You picked:{" "}
                      {currentUserPicks
                        .map(
                          (p) =>
                            (p.contestant as { name: string })?.name ?? "Unknown"
                        )
                        .join(", ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Links */}
            <Card>
              <CardContent className="space-y-2 p-4">
                <Link href={`/league/${leagueId}/history`}>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <Clock className="h-4 w-4" />
                    Pick History
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
