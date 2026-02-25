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
    <div className="rounded-lg border border-border/60 bg-background/45 p-2.5">
      <div className="flex items-start gap-1.5">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
          <Icon className="h-3 w-3" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            title={title}
            className="text-xs font-semibold leading-snug text-foreground sm:text-sm"
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
    <section>
      <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card py-0">
        <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
        <CardContent className="relative space-y-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                League Information
              </p>
              <h1 className="mt-1.5 flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                <span className="truncate">{leagueName}</span>
                {isHost && <Crown className="h-4 w-4 shrink-0 text-yellow-500" />}
              </h1>
            </div>
            <div className="shrink-0 rounded-full border border-border/70 bg-background/65 p-0.5">
              <InviteShareButton inviteCode={inviteCode} />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/55 px-2.5 py-1">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold tabular-nums">{memberCount}</span>
            <span className="text-xs text-muted-foreground">{playerLabel}</span>
          </div>

          <div className="h-px bg-border/60" />

          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Weekly Update
            </p>
            <div className="grid grid-cols-2 gap-2">
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
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
