"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions";
import { LogOut } from "lucide-react";

export function UserMenu({
  username,
  avatarUrl,
}: {
  username: string | null;
  avatarUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">
            {username?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">
          {username}
        </span>
      </div>
      <form action={signOut}>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
