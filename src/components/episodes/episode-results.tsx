"use client";

import { useState, useTransition } from "react";
import { recordEpisodeResults } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TRIBE_COLORS } from "@/lib/constants";
import type { Contestant, Episode } from "@/lib/types";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function EpisodeResults({
  leagueId,
  episode,
  contestants,
}: {
  leagueId: string;
  episode: Episode;
  contestants: Contestant[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  const remaining = contestants.filter((c) => !c.is_eliminated);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setConfirmed(false);
  };

  const handleSubmit = () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    startTransition(async () => {
      const result = await recordEpisodeResults(
        leagueId,
        episode.id,
        Array.from(selected)
      );
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Episode ${episode.number} results recorded!`);
      }
      setConfirmed(false);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Episode {episode.number} — Select eliminated contestant(s)
        </p>
        <Badge variant="secondary">{remaining.length} remaining</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {remaining.map((c) => {
          const colors = TRIBE_COLORS[c.tribe as keyof typeof TRIBE_COLORS];
          const isSelected = selected.has(c.id);

          return (
            <button
              key={c.id}
              onClick={() => toggleSelect(c.id)}
              className={`rounded-lg border-2 p-3 text-left text-sm transition-all ${
                isSelected
                  ? "border-destructive bg-destructive/10"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${colors.badge}`}
                />
                <span className={isSelected ? "text-destructive" : ""}>
                  {c.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="space-y-2">
          {confirmed && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Are you sure? This will eliminate{" "}
              {Array.from(selected)
                .map((id) => contestants.find((c) => c.id === id)?.name)
                .join(", ")}{" "}
              and any league members who picked them.
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            variant={confirmed ? "destructive" : "default"}
            className="w-full gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : confirmed ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {confirmed
              ? "Confirm — Record Results"
              : `Record ${selected.size} Elimination${selected.size > 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}
