"use client";

import { useState, useTransition } from "react";
import { submitPicks } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TRIBE_COLORS } from "@/lib/constants";
import type { Contestant } from "@/lib/types";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ContestantGrid({
  contestants,
  usedContestantIds,
  currentPickIds,
  requiredPicks,
  leagueId,
  episodeId,
}: {
  contestants: Contestant[];
  usedContestantIds: string[];
  currentPickIds: string[];
  requiredPicks: number;
  leagueId: string;
  episodeId: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentPickIds)
  );
  const [isPending, startTransition] = useTransition();

  const usedSet = new Set(usedContestantIds);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= requiredPicks) {
          toast.error(
            `You can only select ${requiredPicks} contestant${requiredPicks > 1 ? "s" : ""}`
          );
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size !== requiredPicks) {
      toast.error(`Select exactly ${requiredPicks} contestant${requiredPicks > 1 ? "s" : ""}`);
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
        toast.success("Picks submitted!");
      }
    });
  };

  // Group by tribe
  const tribes = ["Vatu", "Cila", "Kalo"] as const;
  const grouped = tribes.map((tribe) => ({
    tribe,
    contestants: contestants.filter((c) => c.tribe === tribe),
  }));

  return (
    <div className="space-y-8">
      {grouped.map(({ tribe, contestants: tribeContestants }) => {
        const colors = TRIBE_COLORS[tribe];
        return (
          <div key={tribe}>
            <div className="mb-3 flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${colors.badge}`}
              />
              <h2 className={`text-lg font-semibold ${colors.text}`}>
                {tribe}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {tribeContestants.map((c) => {
                const isUsed = usedSet.has(c.id);
                const isEliminated = c.is_eliminated;
                const isSelected = selected.has(c.id);
                const isDisabled = isUsed || isEliminated;

                return (
                  <button
                    key={c.id}
                    onClick={() => !isDisabled && toggleSelect(c.id)}
                    disabled={isDisabled}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                      isDisabled
                        ? "cursor-not-allowed border-border/30 opacity-40"
                        : isSelected
                          ? `${colors.border} ${colors.bg} ring-2 ring-offset-2 ring-offset-background ${colors.border.replace("border-", "ring-")}`
                          : "border-border/50 hover:border-border hover:bg-accent/50"
                    }`}
                  >
                    {/* Status overlay */}
                    {isEliminated && (
                      <div className="absolute right-2 top-2">
                        <X className="h-5 w-5 text-destructive" />
                      </div>
                    )}
                    {isUsed && !isEliminated && (
                      <div className="absolute right-2 top-2">
                        <Badge variant="secondary" className="text-[10px]">
                          Used
                        </Badge>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute right-2 top-2">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${colors.badge}`}>
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    )}

                    {/* Contestant info */}
                    <div className="pr-6">
                      <div className="mb-1 h-12 w-12 rounded-full bg-accent/50 flex items-center justify-center text-lg font-bold text-muted-foreground">
                        {c.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <p className="text-sm font-medium leading-tight">
                        {c.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Submit button */}
      <div className="sticky bottom-4 flex justify-center">
        <Button
          onClick={handleSubmit}
          disabled={isPending || selected.size !== requiredPicks}
          size="lg"
          className="gap-2 shadow-lg"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Submit {selected.size}/{requiredPicks} Pick
          {requiredPicks > 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
