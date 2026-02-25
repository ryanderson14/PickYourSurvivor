"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export function GetStartedCta() {
  const [showGoogleButton, setShowGoogleButton] = useState(false);

  return (
    <div className="relative h-12 w-full sm:min-w-[220px] sm:w-auto">
      <Button
        type="button"
        size="lg"
        onClick={() => setShowGoogleButton(true)}
        className={`h-12 w-full gap-2 text-base shadow-lg shadow-primary/15 transition-all duration-300 ease-out sm:w-auto ${
          showGoogleButton
            ? "pointer-events-none translate-y-2 scale-95 opacity-0"
            : "translate-y-0 scale-100 opacity-100"
        }`}
      >
        Get Started
        <ArrowRight className="h-4 w-4" />
      </Button>

      <div
        className={`absolute inset-0 transition-all duration-300 ease-out ${
          showGoogleButton
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-95 opacity-0"
        }`}
      >
        <GoogleSignInButton
          next="/dashboard"
          label="Sign in with Google"
          size="lg"
          className="h-12 w-full text-base shadow-lg shadow-primary/15 sm:w-auto"
        />
      </div>
    </div>
  );
}
