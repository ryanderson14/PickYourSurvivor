"use client";

import { useEffect, useState } from "react";
import { Clock, Lock } from "lucide-react";

export function CountdownTimer({ airDate }: { airDate: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = new Date(airDate).getTime() - Date.now();
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
  }, [airDate]);

  return (
    <div
      className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium ${
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
      <span>{isLocked ? "Picks are locked" : `Locks in ${timeLeft}`}</span>
    </div>
  );
}
