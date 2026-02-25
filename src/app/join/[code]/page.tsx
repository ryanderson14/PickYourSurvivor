import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Flame, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const admin = createAdminClient();

  const { data: league } = await admin
    .from("leagues")
    .select("name, season")
    .eq("invite_code", code.toUpperCase())
    .maybeSingle();

  if (!league) {
    return {
      title: "Invalid Invite — Pick Your Survivor",
    };
  }

  const ogImageUrl = `/api/og?league=${encodeURIComponent(league.name)}&season=${league.season}`;

  return {
    title: `Join ${league.name} — Pick Your Survivor`,
    description: `You've been invited to join ${league.name} for Survivor Season ${league.season}. Pick your survivors and outlast the competition!`,
    openGraph: {
      title: `You're invited to ${league.name}!`,
      description: `Join Pick Your Survivor Season ${league.season} · Last player standing wins.`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `Join ${league.name}`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `You're invited to ${league.name}!`,
      description: `Join Pick Your Survivor Season ${league.season}`,
      images: [ogImageUrl],
    },
  };
}

export default async function JoinPage({ params }: Props) {
  const { code } = await params;
  const upperCode = code.toUpperCase();

  // Fetch league info using admin client so unauthenticated users can see it
  const admin = createAdminClient();
  const { data: league } = await admin
    .from("leagues")
    .select("id, name, season, invite_code")
    .eq("invite_code", upperCode)
    .maybeSingle();

  if (!league) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <Flame className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Invalid Invite</h1>
          <p className="text-muted-foreground">
            This invite link is invalid or the league no longer exists.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Check if user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Check if already a member
    const { data: existing } = await supabase
      .from("league_members")
      .select("id")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      redirect(`/league/${league.id}`);
    }

    // Join the league
    const { error } = await supabase
      .from("league_members")
      .insert({ league_id: league.id, user_id: user.id });

    if (!error || error.code === "23505") {
      redirect(`/league/${league.id}`);
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold">Couldn&apos;t join</h1>
          <p className="text-muted-foreground">
            Something went wrong joining the league. Try visiting your dashboard
            and entering the code manually.
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Not authenticated — show invite landing page
  const loginHref = `/login?next=${encodeURIComponent(`/join/${upperCode}`)}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Header */}
        <div className="space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Flame className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              You&apos;re Invited
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{league.name}</h1>
            <p className="text-muted-foreground">
              Survivor Season {league.season} · Pick Your Survivor
            </p>
          </div>
        </div>

        {/* League info */}
        <div className="rounded-xl border border-border/50 bg-card px-6 py-5">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Join the league and make your picks before each episode</span>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Button asChild size="lg" className="w-full gap-2 text-base">
            <Link href={loginHref}>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google &amp; Join
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href={loginHref} className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
