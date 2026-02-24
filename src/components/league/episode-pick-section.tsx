"use client";

import { useState, useRef, useEffect } from "react";
import { EpisodeBanner } from "./episode-banner";
import type { PickStatus } from "./episode-banner";
import { ContestantGrid } from "@/components/picks/contestant-grid";
import type { Contestant, Episode } from "@/lib/types";

export { type PickStatus };

export function EpisodePickSection({
  episode,
  pickStatus,
  contestants,
  usedContestantIds,
  currentPickIds,
  requiredPicks,
  leagueId,
  isLocked,
  isEliminated,
}: {
  episode: Episode;
  pickStatus: PickStatus;
  contestants: Contestant[];
  usedContestantIds: string[];
  currentPickIds: string[];
  requiredPicks: number;
  leagueId: string;
  isLocked: boolean;
  isEliminated: boolean;
}) {
  // Default: open if user hasn't picked yet (pick-below or debt with 0 picked)
  const needsPick =
    pickStatus.kind === "pick-below" ||
    (pickStatus.kind === "debt" && pickStatus.picked < pickStatus.required);
  const [isOpen, setIsOpen] = useState(needsPick);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync open state if pickStatus changes externally (e.g. revalidation)
  useEffect(() => {
    if (needsPick) setIsOpen(true);
  }, [needsPick]);

  const handleToggle = () => setIsOpen((prev) => !prev);

  const handlePickSubmitted = () => {
    setIsOpen(false);
  };

  return (
    <div>
      <EpisodeBanner
        episode={episode}
        pickStatus={pickStatus}
        isOpen={isOpen}
        onToggle={handleToggle}
      />

      {/* Collapsible grid */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden" ref={contentRef}>
          <div className="pt-4">
            <ContestantGrid
              contestants={contestants}
              usedContestantIds={usedContestantIds}
              currentPickIds={currentPickIds}
              requiredPicks={requiredPicks}
              leagueId={leagueId}
              episodeId={episode.id}
              isLocked={isLocked}
              isEliminated={isEliminated}
              onPickSubmitted={handlePickSubmitted}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
