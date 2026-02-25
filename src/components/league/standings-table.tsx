"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skull, Shield, ChevronDown, Minus, Check } from "lucide-react";
import { getContestantPhotoUrl } from "@/lib/cast";
import Image from "next/image";
import type { Contestant } from "@/lib/types";

type PickHistoryEntry = {
  episodeNumber: number;
  contestant: Pick<Contestant, "name" | "image_url" | "tribe"> | null;
  survived: boolean;
  missed: boolean;
};

export type MemberWithStats = {
  user_id: string;
  is_eliminated: boolean;
  eliminated_at_episode: number | null;
  picksUsed: number;
  availableContestants: number;
  profile: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  pickHistory: PickHistoryEntry[];
};

function PickHistoryList({ history }: { history: PickHistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <div className="space-y-1">
      {history.map((entry, index) => {
        const borderColor = entry.missed
          ? "border-l-muted-foreground/30 border-dashed"
          : entry.survived
            ? "border-l-green-500"
            : "border-l-red-500";

        return (
          <div
            key={`${entry.episodeNumber}-${index}`}
            className={`flex items-center gap-3 rounded-r-lg border-l-2 py-1.5 pl-3 ${borderColor}`}
          >
            {/* Photo or dash */}
            {entry.missed || !entry.contestant ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
                <Minus className="h-4 w-4 text-muted-foreground/40" />
              </div>
            ) : (
              <div
                className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 ${
                  entry.survived ? "border-green-500" : "border-red-500"
                }`}
              >
                <Image
                  src={getContestantPhotoUrl(entry.contestant)}
                  alt={entry.contestant.name}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
                {!entry.survived && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Skull className="h-4 w-4 text-red-400" />
                  </div>
                )}
              </div>
            )}

            {/* Episode + name */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  Ep. {entry.episodeNumber}
                </span>
                <span className="truncate text-sm font-medium">
                  {entry.missed
                    ? "Missed"
                    : entry.contestant?.name ?? "Unknown"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StandingsTable({
  members,
  currentUserId,
  episodeWindowOpen = false,
  pickedUserIds = [],
  lockedEpisodePicks,
  currentEpisodeNumber,
}: {
  members: MemberWithStats[];
  currentUserId: string;
  episodeWindowOpen?: boolean;
  pickedUserIds?: string[];
  lockedEpisodePicks?: Array<{
    user_id: string;
    contestants: Pick<Contestant, "name" | "image_url" | "tribe">[];
  }>;
  currentEpisodeNumber?: number;
}) {
  const pickedSet = new Set(pickedUserIds);
  const lockedPicksMap = new Map(
    lockedEpisodePicks?.map((p) => [p.user_id, p.contestants]) ?? []
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const sorted = [...members].sort((a, b) => {
    if (a.is_eliminated !== b.is_eliminated) return a.is_eliminated ? 1 : -1;
    if (!a.is_eliminated && !b.is_eliminated) {
      return b.availableContestants - a.availableContestants;
    }
    return (b.eliminated_at_episode ?? 0) - (a.eliminated_at_episode ?? 0);
  });

  const toggleExpand = (userId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {sorted.map((member, index) => {
        const isCurrentUser = member.user_id === currentUserId;
        const isExpanded = expandedRows.has(member.user_id);
        const hasHistory = member.pickHistory.length > 0;
        const currentPicks = lockedPicksMap.get(member.user_id);
        const isExpandable = hasHistory || !!currentPicks;

        return (
          <div
            key={member.user_id}
            className={`rounded-lg transition-colors ${
              member.is_eliminated
                ? "opacity-50"
                : isCurrentUser
                  ? "bg-primary/5 ring-1 ring-primary/20"
                  : "bg-accent/30"
            }`}
          >
            {/* Identity bar */}
            <button
              onClick={isExpandable ? () => toggleExpand(member.user_id) : undefined}
              className={`flex w-full items-center gap-3 p-4 text-left ${
                isExpandable ? "cursor-pointer" : ""
              }`}
            >
              <span className="w-6 text-center text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-sm">
                  {member.profile.username?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.profile.username}
                  {isCurrentUser && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </p>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-2">
                {member.is_eliminated ? (
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <Skull className="h-3 w-3" />
                    Out Ep. {member.eliminated_at_episode}
                  </Badge>
                ) : episodeWindowOpen ? (
                  pickedSet.has(member.user_id) ? (
                    <Badge variant="outline" className="gap-1 text-xs border-green-500/40 text-green-500">
                      <Check className="h-3 w-3" />
                      Locked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Not Picked
                    </Badge>
                  )
                ) : lockedEpisodePicks !== undefined ? (
                  currentPicks ? (
                    <div className="flex -space-x-1.5">
                      {currentPicks.map((c, i) => (
                        <div
                          key={i}
                          className="relative h-7 w-7 overflow-hidden rounded-full border-2 border-background"
                        >
                          <Image
                            src={getContestantPhotoUrl(c)}
                            alt={c.name}
                            fill
                            sizes="28px"
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground/50">
                      No pick
                    </Badge>
                  )
                ) : null}
                {!member.is_eliminated && (
                  <div
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 text-xs font-medium text-primary"
                    aria-label={`${member.availableContestants} picks remaining`}
                    title={`${member.availableContestants} picks remaining`}
                  >
                    <Shield className="h-3 w-3" />
                    <span className="tabular-nums">{member.availableContestants}</span>
                    <span className="hidden sm:inline">left</span>
                  </div>
                )}
                {isExpandable && (
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                )}
              </div>
            </button>

            {/* Expanded: current episode pick (pending) + past history */}
            {isExpandable && (
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  isExpanded
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-border/30 px-3 pb-3 pt-2 pl-14">
                    <div className="space-y-1">
                      {/* Past pick history */}
                      <PickHistoryList history={member.pickHistory} />
                      {/* Current locked episode pick — pending outcome */}
                      {currentPicks && currentEpisodeNumber !== undefined && (
                        currentPicks.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-r-lg border-l-2 border-l-muted-foreground/20 py-1.5 pl-3"
                          >
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-muted-foreground/20">
                              <Image
                                src={getContestantPhotoUrl(c)}
                                alt={c.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                  Ep. {currentEpisodeNumber}
                                </span>
                                <span className="truncate text-sm font-medium">
                                  {c.name}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
