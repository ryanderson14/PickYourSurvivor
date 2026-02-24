import Link from "next/link";
import { Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/auth/user-menu";
import { HowToPlayButton } from "@/components/layout/how-to-play-button";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" />
          <span className="font-bold">Pick Your Survivor</span>
        </Link>
        <div className="flex items-center gap-1">
          <HowToPlayButton />
          {profile && (
            <UserMenu
              username={profile.username}
              avatarUrl={profile.avatar_url}
            />
          )}
        </div>
      </div>
    </header>
  );
}
