import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsernameForm } from "./username-form";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const { next } = await searchParams;

  if (profile?.username) {
    redirect(next && next.startsWith("/") ? next : "/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Choose your username</h1>
          <p className="text-muted-foreground">
            This is how other players will see you in the league.
          </p>
        </div>
        <UsernameForm next={next} />
      </div>
    </div>
  );
}
