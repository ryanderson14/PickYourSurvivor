"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/actions";
import { LogOut, ShieldCheck } from "lucide-react";

export function UserMenu({
  username,
  avatarUrl,
  showOwnerTools,
}: {
  username: string | null;
  avatarUrl: string | null;
  showOwnerTools: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.95]">
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs">
              {username?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">
            {username ?? "Player"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showOwnerTools && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin/weekly">
                <ShieldCheck className="h-4 w-4" />
                Weekly Update
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
