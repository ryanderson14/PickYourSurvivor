"use client";

import { useState, useTransition } from "react";
import { submitPicks } from "@/app/actions";
import { TRIBE_COLORS } from "@/lib/constants";
import { getContestantPhotoUrl } from "@/lib/cast";
import type { Contestant } from "@/lib/types";
import { Check, X, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export function ContestantGrid({
  contestants,
  usedContestantIds,
  currentPickIds,
  requiredPicks,
  leagueId,
  episodeId,
  isLocked,
  isEliminated,
}: {
  contestants: Contestant[];
  usedContestantIds: string[];
  currentPickIds: string[];
  requiredPicks: number;
  leagueId: string;
  episodeId: string;
  isLocked: boolean;
  isEliminated: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentPickIds)
  );
  const [isPending, startTransition] = useTransition();
  const interactive = !isLocked && !isEliminated;

  const usedSet = new Set(usedContestantIds);

  // Sort: available first, then used (greyed), then eliminated (greyed + X)
  const sorted = [...contestants].sort((a, b) => {
    const aElim = a.is_eliminated ? 2 : usedSet.has(a.id) ? 1 : 0;
    const bElim = b.is_eliminated ? 2 : usedSet.has(b.id) ? 1 : 0;
    if (aElim !== bElim) return aElim - bElim;
    return a.name.localeCompare(b.name);
  });

  const toggleSelect = (id: string) => {
    if (!interactive) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (requiredPicks === 1) {
          // Radio behavior: replace previous selection
          next.clear();
          next.add(id);
        } else if (next.size >= requiredPicks) {
          toast.error(
            `You can only select ${requiredPicks} contestant${requiredPicks > 1 ? "s" : ""}`
          );
          return prev;
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size !== requiredPicks) {
      toast.error(
        `Select exactly ${requiredPicks} contestant${requiredPicks > 1 ? "s" : ""}`
      );
      return;
    }
    startTransition(async () => {
      const result = await submitPicks(
        leagueId,
        episodeId,
        Array.from(selected)
      );
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Pick locked in!");
      }
    });
  };

  const selectedNames = sorted
    .filter((c) => selected.has(c.id))
    .map((c) => c.name.split(" ")[0]);

  return (
    <div className="relative">
      {/* Debt warning */}
      {requiredPicks > 1 && interactive && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-orange-500/10 p-3 text-sm text-orange-400">
          <span className="font-medium">
            {selected.size} of {requiredPicks} selected
          </span>
          <span className="text-orange-400/70">
            — {requiredPicks - 1} missed week{requiredPicks > 2 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Contestant grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {sorted.map((c) => {
          const isUsed = usedSet.has(c.id);
          const isElim = c.is_eliminated;
          const isSelected = selected.has(c.id);
          const isDisabled = isUsed || isElim || !interactive;
          const colors =
            TRIBE_COLORS[c.tribe as keyof typeof TRIBE_COLORS] ??
            TRIBE_COLORS.Vatu;

          return (
            <button
              key={c.id}
              onClick={() => !isDisabled && toggleSelect(c.id)}
              disabled={isDisabled && !isSelected}
              className={`group relative overflow-hidden rounded-xl transition-all ${
                isSelected
                  ? `ring-3 ring-offset-2 ring-offset-background ${colors.ring}`
                  : ""
              } ${
                isDisabled && !isSelected
                  ? "cursor-default opacity-40"
                  : isSelected
                    ? "scale-[1.02]"
                    : "hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {/* Photo */}
              <div
                className={`relative aspect-[3/4] w-full overflow-hidden rounded-xl ${
                  isUsed || isElim ? "grayscale" : ""
                }`}
              >
                <Image
                  src={getContestantPhotoUrl(c)}
                  alt={c.name}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                  className="object-cover"
                />

                {/* Gradient overlay for name */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-8">
                  <p className="text-xs font-semibold leading-tight text-white sm:text-sm">
                    {c.name.split(" ")[0]}
                  </p>
                </div>

                {/* Tribe accent bar */}
                <div
                  className={`absolute inset-x-0 bottom-0 h-1 ${colors.badge}`}
                />

                {/* Selected checkmark overlay */}
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${colors.badge}`}
                    >
                      <Check className="h-5 w-5 text-white" />
                    </div>
                  </div>
                )}

                {/* Eliminated X overlay */}
                {isElim && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <X className="h-10 w-10 text-red-500" />
                  </div>
                )}

                {/* Used badge */}
                {isUsed && !isElim && (
                  <div className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Used
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Floating Lock In button */}
      {interactive && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
          <button
            onClick={handleSubmit}
            disabled={isPending || selected.size !== requiredPicks}
            className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-xl transition-all ${
              isPending || selected.size !== requiredPicks
                ? "bg-muted-foreground/50 cursor-not-allowed"
                : "bg-primary hover:bg-primary/90 active:scale-95"
            }`}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {requiredPicks === 1
              ? `Lock In ${selectedNames[0] ?? ""}`
              : `Lock In ${selected.size}/${requiredPicks}`}
          </button>
        </div>
      )}
    </div>
  );
}
