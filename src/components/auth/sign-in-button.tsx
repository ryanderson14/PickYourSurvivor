"use client";

import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export function SignInButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Sign In
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Flame className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Pick Your Survivor</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Sign in to join a league</p>
            </div>
          </div>
          <GoogleSignInButton label="Continue with Google" className="w-full" />
        </div>
      </PopoverContent>
    </Popover>
  );
}
