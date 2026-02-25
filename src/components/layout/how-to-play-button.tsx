"use client";

import {
  CircleHelp,
  Flame,
  Shield,
  UserX,
  Clock,
  Trophy,
  AlertTriangle,
  Repeat2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const rules = [
  {
    icon: Shield,
    iconClass: "text-primary",
    bgClass: "bg-primary/10",
    title: "Pick One Each Week",
    description:
      "Each episode, pick one contestant you think will survive the week. You can only use each contestant once all season — choose wisely.",
  },
  {
    icon: UserX,
    iconClass: "text-destructive",
    bgClass: "bg-destructive/10",
    title: "Get Voted Out, Get Eliminated",
    description:
      "If your pick is voted out or eliminated from the show, you're out of the league. No second chances.",
  },
  {
    icon: Clock,
    iconClass: "text-orange-400",
    bgClass: "bg-orange-500/10",
    title: "Picks Lock at Airtime",
    description:
      "You must submit your pick before the episode airs. Once it's locked, no changes can be made.",
  },
  {
    icon: Repeat2,
    iconClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
    title: "Missed a Week? Catch Up",
    description:
      "If you miss episodes in a row, you carry a \"pick debt.\" You'll need extra picks next week — one for each consecutive episode missed right before it.",
  },
  {
    icon: AlertTriangle,
    iconClass: "text-yellow-400",
    bgClass: "bg-yellow-500/10",
    title: "Miss 3 Weeks in a Row? You're Out",
    description:
      "Miss three consecutive episodes without submitting any picks and you'll be automatically eliminated from the league.",
  },
  {
    icon: Trophy,
    iconClass: "text-primary",
    bgClass: "bg-primary/10",
    title: "Last One Standing Wins",
    description:
      "Outlast every other player in your league to win. If multiple players survive to the finale, they all share the win.",
  },
];

export function HowToPlayButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <CircleHelp className="h-4 w-4" />
          <span className="hidden sm:inline">How to Play</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Flame className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-lg">How to Play</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Pick Your Survivor — Season 50
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {rules.map(({ icon: Icon, iconClass, bgClass, title, description }) => (
            <div
              key={title}
              className="flex gap-3 rounded-lg border border-border/50 bg-card p-4"
            >
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${bgClass}`}
              >
                <Icon className={`h-4 w-4 ${iconClass}`} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-snug">{title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground/60">
          Good luck — may your picks survive.
        </p>
      </DialogContent>
    </Dialog>
  );
}
