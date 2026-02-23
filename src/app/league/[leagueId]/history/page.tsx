import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Skull, Check } from "lucide-react";
import { TRIBE_COLORS } from "@/lib/constants";

export default async function HistoryPage({
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

  const { data: league } = await supabase
    .from("leagues")
    .select("name")
    .eq("id", leagueId)
    .single();

  if (!league) redirect("/dashboard");

  // Get members with profiles
  const { data: members } = await supabase
    .from("league_members")
    .select("*, profile:profiles(username, avatar_url)")
    .eq("league_id", leagueId)
    .order("is_eliminated")
    .order("joined_at");

  // Get completed episodes
  const { data: episodes } = await supabase
    .from("episodes")
    .select("*")
    .eq("is_complete", true)
    .order("number");

  // Get all picks for completed episodes (visible due to RLS)
  const { data: picks } = await supabase
    .from("picks")
    .select("*, contestant:contestants(name, tribe, tribe_color, is_eliminated)")
    .eq("league_id", leagueId);

  // Get all contestants
  const { data: contestants } = await supabase
    .from("contestants")
    .select("*")
    .eq("season", 50);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link
          href={`/league/${leagueId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {league.name}
        </Link>

        <h1 className="mb-8 text-2xl font-bold">Pick History</h1>

        {!episodes || episodes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No episodes completed yet. History will appear after Episode 1.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 bg-background px-3 py-2 text-left font-medium">
                    Player
                  </th>
                  {episodes.map((ep) => (
                    <th
                      key={ep.id}
                      className="min-w-[120px] px-3 py-2 text-center font-medium"
                    >
                      Ep. {ep.number}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members?.map((member) => {
                  const profile = member.profile as {
                    username: string;
                    avatar_url: string | null;
                  };
                  return (
                    <tr
                      key={member.user_id}
                      className={`border-b border-border/50 ${
                        member.is_eliminated ? "opacity-50" : ""
                      }`}
                    >
                      <td className="sticky left-0 bg-background px-3 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {profile.username}
                          {member.is_eliminated && (
                            <Skull className="h-3 w-3 text-destructive" />
                          )}
                        </div>
                      </td>
                      {episodes.map((ep) => {
                        const memberPicks = picks?.filter(
                          (p) =>
                            p.user_id === member.user_id &&
                            p.episode_id === ep.id
                        );

                        if (!memberPicks || memberPicks.length === 0) {
                          return (
                            <td
                              key={ep.id}
                              className="px-3 py-3 text-center text-muted-foreground"
                            >
                              —
                            </td>
                          );
                        }

                        return (
                          <td key={ep.id} className="px-3 py-3">
                            <div className="flex flex-col items-center gap-1">
                              {memberPicks.map((pick) => {
                                const contestant = pick.contestant as {
                                  name: string;
                                  tribe: string;
                                  tribe_color: string;
                                  is_eliminated: boolean;
                                };
                                const wasEliminatedThisEp =
                                  contestants?.find(
                                    (c) =>
                                      c.id === pick.contestant_id &&
                                      c.eliminated_at_episode === ep.number
                                  );
                                const colors =
                                  TRIBE_COLORS[
                                    contestant.tribe as keyof typeof TRIBE_COLORS
                                  ];

                                return (
                                  <div
                                    key={pick.id}
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                                      wasEliminatedThisEp
                                        ? "bg-destructive/20 text-destructive line-through"
                                        : `${colors.bg} ${colors.text}`
                                    }`}
                                  >
                                    {contestant.name.split(" ").pop()}
                                    {wasEliminatedThisEp && (
                                      <Skull className="h-3 w-3" />
                                    )}
                                    {!wasEliminatedThisEp && (
                                      <Check className="h-3 w-3" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
