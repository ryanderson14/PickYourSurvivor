export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type League = {
  id: string;
  name: string;
  invite_code: string;
  host_id: string;
  season: number;
  created_at: string;
};

export type LeagueMember = {
  id: string;
  league_id: string;
  user_id: string;
  is_eliminated: boolean;
  eliminated_at_episode: number | null;
  joined_at: string;
  profile?: Profile;
};

export type Contestant = {
  id: string;
  name: string;
  tribe: "Vatu" | "Cila" | "Kalo";
  tribe_color: "blue" | "orange" | "purple";
  image_url: string | null;
  season: number;
  is_eliminated: boolean;
  eliminated_at_episode: number | null;
};

export type Episode = {
  id: string;
  number: number;
  title: string | null;
  air_date: string;
  is_complete: boolean;
};

export type Pick = {
  id: string;
  league_id: string;
  user_id: string;
  episode_id: string;
  contestant_id: string;
  created_at: string;
  contestant?: Contestant;
  episode?: Episode;
};

export type LeagueWithDetails = League & {
  members: (LeagueMember & { profile: Profile })[];
  host: Profile;
};
