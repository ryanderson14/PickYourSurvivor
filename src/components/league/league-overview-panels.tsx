import type { LucideIcon } from "lucide-react";
import { Crown, Lock, Skull, Tv, Users } from "lucide-react";
import { InviteShareButton } from "@/components/league/invite-share-button";
import { Card, CardContent } from "@/components/ui/card";

function formatLastEliminated(names: string[]): string {
  if (names.length === 0) return "None";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]} +${names.length - 1}`;
}

function UpdateTile({
  icon: Icon,
  label,
  value,
  title,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/45 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            title={title}
            className="text-sm font-semibold leading-snug text-foreground"
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LeagueOverviewPanels({
  leagueName,
  isHost,
  memberCount,
  inviteCode,
  currentEpisodeNumber,
  lastEpisodeEliminated,
  survivorsRemaining,
  nextPicksLockTime,
}: {
  leagueName: string;
  isHost: boolean;
  memberCount: number;
  inviteCode: string;
  currentEpisodeNumber: number | null;
  lastEpisodeEliminated: string[];
  survivorsRemaining: number;
  nextPicksLockTime: string | null;
}) {
  const playerLabel = memberCount === 1 ? "player" : "players";
  const lastOutSummary = formatLastEliminated(lastEpisodeEliminated);
  const lastOutFullNames =
    lastEpisodeEliminated.length > 1
      ? lastEpisodeEliminated.join(", ")
      : undefined;
  const lockValue =
    nextPicksLockTime ??
    (currentEpisodeNumber === null ? "Season complete" : "TBD");

  return (
    <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card py-0">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
        <CardContent className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                League Information
              </p>
              <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
                <span className="truncate">{leagueName}</span>
                {isHost && <Crown className="h-5 w-5 shrink-0 text-yellow-500" />}
              </h1>
            </div>
            <div className="rounded-full border border-border/70 bg-background/65 p-1">
              <InviteShareButton inviteCode={inviteCode} />
            </div>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/55 px-3 py-1.5">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold tabular-nums">{memberCount}</span>
            <span className="text-sm text-muted-foreground">{playerLabel}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-muted/30 py-0">
        <div className="pointer-events-none absolute -bottom-24 -left-14 h-44 w-44 rounded-full bg-primary/12 blur-3xl" />
        <CardContent className="relative p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Weekly Update
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <UpdateTile
              icon={Tv}
              label="Episode"
              value={
                currentEpisodeNumber === null
                  ? "Complete"
                  : `Episode ${currentEpisodeNumber}`
              }
            />
            <UpdateTile
              icon={Skull}
              label="Last Out"
              value={lastOutSummary}
              title={lastOutFullNames}
            />
            <UpdateTile
              icon={Users}
              label="Left In Game"
              value={String(survivorsRemaining)}
            />
            <UpdateTile icon={Lock} label="Picks Lock" value={lockValue} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
