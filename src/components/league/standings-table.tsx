"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skull, Shield, ChevronDown, Minus } from "lucide-react";
import { getContestantPhotoUrl } from "@/lib/cast";
import Image from "next/image";
import type { Contestant } from "@/lib/types";

type PickHistoryEntry = {
  episodeNumber: number;
  contestant: Pick<Contestant, "name" | "image_url" | "tribe"> | null;
  survived: boolean; // true = survived, false = eliminated that episode
  missed: boolean; // true = no pick made
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

function PickHistoryTimeline({
  history,
}: {
  history: PickHistoryEntry[];
}) {
  if (history.length === 0) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto py-1">
      {history.map((entry) => (
        <div
          key={entry.episodeNumber}
          className="flex shrink-0 flex-col items-center gap-0.5"
        >
          {entry.missed ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
              <Minus className="h-3 w-3 text-muted-foreground/40" />
            </div>
          ) : entry.contestant ? (
            <div
              className={`relative h-8 w-8 overflow-hidden rounded-full border-2 ${
                entry.survived
                  ? "border-green-500"
                  : "border-red-500"
              }`}
            >
              <Image
                src={getContestantPhotoUrl(entry.contestant)}
                alt={entry.contestant.name}
                fill
                sizes="32px"
                className="object-cover"
              />
              {!entry.survived && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Skull className="h-3 w-3 text-red-400" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
              <Minus className="h-3 w-3 text-muted-foreground/40" />
            </div>
          )}
          <span className="text-[10px] text-muted-foreground">
            {entry.episodeNumber}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StandingsTable({
  members,
  currentUserId,
}: {
  members: MemberWithStats[];
  currentUserId: string;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Sort: active first (by available picks desc), then eliminated (by episode desc)
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
            <div className="flex items-center gap-3 p-3">
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
                ) : (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Shield className="h-3 w-3" />
                    {member.availableContestants} left
                  </Badge>
                )}
                {/* Mobile expand toggle */}
                {hasHistory && (
                  <button
                    onClick={() => toggleExpand(member.user_id)}
                    className="lg:hidden rounded p-1 hover:bg-accent"
                  >
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Pick history timeline - always visible on desktop, expandable on mobile */}
            {hasHistory && (
              <div
                className={`border-t border-border/30 px-3 pb-3 pt-2 ${
                  isExpanded ? "block" : "hidden lg:block"
                }`}
              >
                <PickHistoryTimeline history={member.pickHistory} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
