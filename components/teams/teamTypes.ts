export type TeamItem = {
  id: string;
  user_id: string;
  name: string;
  short_name: string;
  sport: string;
  city: string;
  founded_year: string;
  kit_home: string;
  kit_away: string;
  coach: string;
  description: string;
  created_at: string;
  updated_at: string;
  player_count?: number;
  owner_name?: string;
  owner_email?: string;
};

export type PlayerItem = {
  id: string;
  team_id: string;
  name: string;
  jersey_number: string;
  position: string;
  birth_date: string;
  mobile: string;
  national_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export const emptyTeamForm = {
  name: "",
  short_name: "",
  sport: "فوتبال",
  city: "",
  founded_year: "",
  kit_home: "",
  kit_away: "",
  coach: "",
  description: "",
};

export const emptyPlayerForm = {
  name: "",
  jersey_number: "",
  position: "",
  birth_date: "",
  mobile: "",
  national_id: "",
  status: "active",
};
