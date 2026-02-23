import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skull, Shield } from "lucide-react";

type MemberWithStats = {
  user_id: string;
  is_eliminated: boolean;
  eliminated_at_episode: number | null;
  picksUsed: number;
  availableContestants: number;
  profile: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
};

export function StandingsTable({
  members,
  currentUserId,
}: {
  members: MemberWithStats[];
  currentUserId: string;
}) {
  // Sort: active first (by available picks desc), then eliminated (by episode desc)
  const sorted = [...members].sort((a, b) => {
    if (a.is_eliminated !== b.is_eliminated) return a.is_eliminated ? 1 : -1;
    if (!a.is_eliminated && !b.is_eliminated) {
      return b.availableContestants - a.availableContestants;
    }
    return (b.eliminated_at_episode ?? 0) - (a.eliminated_at_episode ?? 0);
  });

  return (
    <div className="space-y-2">
      {sorted.map((member, index) => {
        const isCurrentUser = member.user_id === currentUserId;
        return (
          <div
            key={member.user_id}
            className={`flex items-center gap-3 rounded-lg p-3 ${
              member.is_eliminated
                ? "opacity-50"
                : isCurrentUser
                  ? "bg-primary/5 ring-1 ring-primary/20"
                  : "bg-accent/30"
            }`}
          >
            <span className="w-6 text-center text-sm font-medium text-muted-foreground">
              {index + 1}
            </span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={member.profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">
                {member.profile.username?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">
                {member.profile.username}
                {isCurrentUser && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (you)
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {member.is_eliminated ? (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <Skull className="h-3 w-3" />
                  Ep. {member.eliminated_at_episode}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Shield className="h-3 w-3" />
                  {member.availableContestants} left
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
