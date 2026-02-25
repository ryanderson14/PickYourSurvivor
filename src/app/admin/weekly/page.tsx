import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SEASON } from "@/lib/constants";
import {
  OWNER_UNLOCK_COOKIE,
  hasOwnerSecretConfigured,
  isOwnerByIdentity,
  isOwnerUnlockedByCookie,
} from "@/lib/owner-access";
import { createClient } from "@/lib/supabase/server";
import { lockWeeklyAdmin, publishWeeklyUpdate, unlockWeeklyAdmin } from "./actions";

function readParam(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return null;
}

function formatEpisodeLockTime(airDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(airDate));
}

export default async function WeeklyAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const status = readParam(query.status);
  const message = readParam(query.message);

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
  const canManageWeeklyUpdate = allowedByIdentity || unlockedBySecret;

  const [{ data: currentEpisode }, { data: activeContestants }] = canManageWeeklyUpdate
    ? await Promise.all([
        supabase
          .from("episodes")
          .select("id, number, title, air_date")
          .eq("is_complete", false)
          .order("number", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("contestants")
          .select("id, name, tribe")
          .eq("season", SEASON)
          .eq("is_eliminated", false)
          .order("name"),
      ])
    : [{ data: null }, { data: [] }];

  const flashTone =
    status === "error"
      ? "error"
      : status === "success"
        ? "success"
        : null;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Weekly Update</h1>
          <p className="text-sm text-muted-foreground">
            Mark who was voted out, then close the current episode.
          </p>
        </div>

        {flashTone && message && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              flashTone === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-primary/30 bg-primary/10 text-primary"
            }`}
          >
            {message}
          </div>
        )}

        {!canManageWeeklyUpdate ? (
          <Card>
            <CardHeader>
              <CardTitle>Owner Verification Required</CardTitle>
              <CardDescription>
                Access is restricted by owner email, owner username, or owner password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasOwnerSecretConfigured() ? (
                <form action={unlockWeeklyAdmin} className="max-w-sm space-y-3">
                  <Input
                    name="owner_password"
                    type="password"
                    placeholder="Owner password"
                    autoComplete="current-password"
                    required
                  />
                  <Button type="submit">Unlock Owner Tools</Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Configure at least one of `OWNER_EMAILS`, `OWNER_USERNAMES`, or
                  `OWNER_SECRET_PASSWORD` in `.env.local`.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {unlockedBySecret && !allowedByIdentity && (
              <form action={lockWeeklyAdmin}>
                <Button type="submit" variant="outline" size="sm">
                  Lock Owner Tools
                </Button>
              </form>
            )}

            {!currentEpisode ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  No open episodes. The season is complete.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Episode {currentEpisode.number}
                    {currentEpisode.title ? ` - ${currentEpisode.title}` : ""}
                  </CardTitle>
                  <CardDescription>
                    Picks lock: {formatEpisodeLockTime(currentEpisode.air_date)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form action={publishWeeklyUpdate} className="space-y-4">
                    <input type="hidden" name="episode_id" value={currentEpisode.id} />

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Voted out this episode</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(activeContestants ?? []).map((contestant) => (
                          <label
                            key={contestant.id}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:bg-accent/30"
                          >
                            <input
                              type="checkbox"
                              name="eliminated_ids"
                              value={contestant.id}
                              className="h-4 w-4 accent-[color:var(--primary)]"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {contestant.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {contestant.tribe}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <Button type="submit">
                      Save Episode {currentEpisode.number} Results
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
