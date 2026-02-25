"use client";

import { useState, useRef } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
