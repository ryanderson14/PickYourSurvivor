import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Upsert profile as a safety net in case the trigger failed
        const { error: profileUpsertError } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            avatar_url: user.user_metadata?.avatar_url ?? null,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );

        if (profileUpsertError) {
          console.error("[auth.callback.profileUpsert]", profileUpsertError);
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();

        if (!profile?.username) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
