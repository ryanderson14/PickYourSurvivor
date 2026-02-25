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
}: {
  members: MemberWithStats[];
  currentUserId: string;
  episodeWindowOpen?: boolean;
  pickedUserIds?: string[];
}) {
  const pickedSet = new Set(pickedUserIds);
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
              onClick={hasHistory ? () => toggleExpand(member.user_id) : undefined}
              className={`flex w-full items-center gap-3 p-3 text-left ${
                hasHistory ? "cursor-pointer" : ""
              }`}
            >
              <span className="w-6 text-center text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
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
              <div className="flex items-center gap-2">
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
                ) : (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Shield className="h-3 w-3" />
                    {member.availableContestants} left
                  </Badge>
                )}
                {hasHistory && (
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                )}
              </div>
            </button>

            {/* Pick history — collapsible vertical list */}
            {hasHistory && (
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  isExpanded
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-border/30 px-3 pb-3 pt-2 pl-12">
                    <PickHistoryList history={member.pickHistory} />
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
