"use client";

import { useState } from "react";
import { ChevronDown, Flame, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function SignInButton({
  next,
  className,
}: {
  next?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 rounded-full border-border/70 bg-background/60 pl-1.5 pr-2.5 shadow-sm transition-all",
            "hover:bg-accent/40 active:scale-[0.98]",
            open ? "ring-2 ring-primary/25" : "",
            className
          )}
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserRound className="h-3 w-3" />
          </span>
          <span>Sign In</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Flame className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Pick Your Survivor</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sign in to join a league
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-1">
          <GoogleSignInButton
            next={next}
            label="Continue with Google"
            className="w-full"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
