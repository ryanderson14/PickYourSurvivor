import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Skull } from "lucide-react";

export function LeagueCard({
  league,
  isEliminated,
  eliminatedAtEpisode,
  isHost,
}: {
  league: {
    id: string;
    name: string;
    invite_code: string;
    host_id: string;
    season: number;
  };
  isEliminated: boolean;
  eliminatedAtEpisode: number | null;
  isHost: boolean;
  currentEpisode: number | null;
}) {
  return (
    <Link href={`/league/${league.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{league.name}</h3>
              {isHost && (
                <Crown className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Code: {league.invite_code}
            </p>
          </div>
          <div>
            {isEliminated ? (
              <Badge variant="destructive" className="gap-1">
                <Skull className="h-3 w-3" />
                Out Ep. {eliminatedAtEpisode}
              </Badge>
            ) : (
              <Badge variant="default" className="bg-primary text-primary-foreground">
                Active
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
