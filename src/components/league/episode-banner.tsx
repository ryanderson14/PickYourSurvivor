"use client";

import { useEffect, useState } from "react";
import { Clock, Lock, AlertTriangle, ChevronDown } from "lucide-react";
import { getContestantPhotoUrl } from "@/lib/cast";
import Image from "next/image";
import type { Contestant, Episode } from "@/lib/types";

export type PickStatus =
  | { kind: "pick-below" }
  | { kind: "picked"; contestant: Pick<Contestant, "name" | "image_url" | "tribe"> }
  | { kind: "locked" }
  | { kind: "eliminated" }
  | { kind: "debt"; required: number; picked: number };

export function EpisodeBanner({
  episode,
  pickStatus,
  isOpen,
  onToggle,
}: {
  episode: Episode;
  pickStatus: PickStatus;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = new Date(episode.air_date).getTime() - Date.now();
      if (diff <= 0) {
        setIsLocked(true);
        setTimeLeft("Locked");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${mins}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      } else {
        setTimeLeft(`${mins}m ${secs}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [episode.air_date]);

  const canToggle =
    pickStatus.kind !== "eliminated" || true; // always toggleable for browse

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Episode label */}
        <div className="shrink-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Episode
          </p>
          <p className="text-2xl font-bold">{episode.number}</p>
        </div>

        {/* Center: Countdown */}
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            isLocked
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          }`}
        >
          {isLocked ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          <span>{isLocked ? "Picks locked" : timeLeft}</span>
        </div>

        {/* Right: Pick status — clickable toggle */}
        <button
          onClick={canToggle ? onToggle : undefined}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
            canToggle ? "cursor-pointer hover:bg-accent/50" : ""
          }`}
        >
          {pickStatus.kind === "picked" && (
            <>
              <div className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-green-500">
                <Image
                  src={getContestantPhotoUrl(pickStatus.contestant)}
                  alt={pickStatus.contestant.name}
                  fill
                  className="object-cover"
                />
              </div>
              <span className="hidden text-sm font-medium text-green-400 sm:inline">
                {pickStatus.contestant.name.split(" ")[0]}
              </span>
            </>
          )}
          {pickStatus.kind === "pick-below" && !isLocked && (
            <span className="text-sm font-medium text-primary">
              Pick now
            </span>
          )}
          {pickStatus.kind === "pick-below" && isLocked && (
            <span className="text-sm text-destructive">No pick</span>
          )}
          {pickStatus.kind === "locked" && (
            <span className="text-sm text-muted-foreground">Locked</span>
          )}
          {pickStatus.kind === "eliminated" && (
            <span className="text-sm text-destructive">Eliminated</span>
          )}
          {pickStatus.kind === "debt" && (
            <div className="flex items-center gap-1 text-sm text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              <span>
                {pickStatus.picked}/{pickStatus.required}
              </span>
            </div>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );
}
