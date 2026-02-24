import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { EpisodeResults } from "@/components/episodes/episode-results";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import type { Contestant, Episode } from "@/lib/types";

export default async function AdminPage({
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

  // Verify host
  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (!league || league.host_id !== user.id) redirect(`/league/${leagueId}`);

  // Get episodes
  const { data: episodes } = await supabase
    .from("episodes")
    .select("*")
    .order("number");

  // Get contestants
  const { data: contestants } = await supabase
    .from("contestants")
    .select("*")
    .eq("season", 50)
    .order("tribe")
    .order("name");

  // Find next incomplete episode
  const nextEpisode = (episodes as Episode[])?.find((e) => !e.is_complete);

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

        <h1 className="mb-8 text-2xl font-bold">League Admin</h1>

        <div className="space-y-6">
          {/* Episode Results */}
          <Card>
            <CardHeader>
              <CardTitle>Record Episode Results</CardTitle>
            </CardHeader>
            <CardContent>
              {nextEpisode ? (
                <EpisodeResults
                  leagueId={leagueId}
                  episode={nextEpisode as Episode}
                  contestants={(contestants ?? []) as Contestant[]}
                />
              ) : (
                <p className="text-muted-foreground">
                  All episodes have been completed.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Completed Episodes */}
          <Card>
            <CardHeader>
              <CardTitle>Completed Episodes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(episodes as Episode[])
                  ?.filter((e) => e.is_complete)
                  .map((ep) => {
                    const eliminated = (contestants as Contestant[])?.filter(
                      (c) => c.eliminated_at_episode === ep.number
                    );
                    return (
                      <div
                        key={ep.id}
                        className="flex items-center justify-between rounded-lg bg-accent/30 p-3"
                      >
                        <span className="text-sm font-medium">
                          Episode {ep.number}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {eliminated.length > 0
                            ? `Eliminated: ${eliminated.map((c) => c.name).join(", ")}`
                            : "No eliminations"}
                        </span>
                      </div>
                    );
                  })}
                {!(episodes as Episode[])?.some((e) => e.is_complete) && (
                  <p className="text-sm text-muted-foreground">
                    No episodes completed yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
