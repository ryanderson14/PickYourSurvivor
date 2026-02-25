import { Flame, Shield, Users, Trophy } from "lucide-react";
import { SignInButton } from "@/components/auth/sign-in-button";
import { GetStartedCta } from "@/components/landing/get-started-cta";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/50 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Pick Your Survivor</span>
        </div>
        <SignInButton next="/dashboard" />
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
            <Flame className="h-4 w-4" />
            Season 50 — Now Playing
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Outlast your friends.
            <br />
            <span className="text-primary">Pick your survivor.</span>
          </h1>

          <p className="mx-auto max-w-md text-lg text-muted-foreground">
            Pick one contestant each week who you think will survive. If they get
            voted out, so do you. Last one standing wins.
          </p>

          <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:justify-center">
            <GetStartedCta />
          </div>
        </div>

        {/* How it works */}
        <div className="mt-20 grid w-full max-w-3xl gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-card p-6 text-left">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <h3 className="mb-1 font-semibold">Join a League</h3>
            <p className="text-sm text-muted-foreground">
              Create a league or join one with an invite code. Play with friends,
              family, or coworkers.
            </p>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-6 text-left">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <Shield className="h-5 w-5 text-orange-400" />
            </div>
            <h3 className="mb-1 font-semibold">Pick Weekly</h3>
            <p className="text-sm text-muted-foreground">
              Each week, pick one contestant to survive. You can only use each
              contestant once all season.
            </p>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-6 text-left">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-1 font-semibold">Last One Standing</h3>
            <p className="text-sm text-muted-foreground">
              If your pick gets eliminated, you&apos;re out. Be the last player
              remaining to win.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
        Pick Your Survivor — Season 50
      </footer>
    </div>
  );
}
