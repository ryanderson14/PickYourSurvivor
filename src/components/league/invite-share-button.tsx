"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Check } from "lucide-react";

export function InviteShareButton({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const inviteUrl = `${window.location.origin}/join/${inviteCode}`;

    // Use the native share sheet on mobile if available
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join my Pick Your Survivor league!",
          text: "Come pick your survivors and outlast the competition.",
          url: inviteUrl,
        });
        return;
      } catch {
        // User cancelled or share not supported — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
      onClick={handleShare}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-primary" />
          <span className="text-primary">Link copied!</span>
        </>
      ) : (
        <>
          <Link2 className="h-3 w-3" />
          <span>Share invite</span>
        </>
      )}
    </Button>
  );
}
