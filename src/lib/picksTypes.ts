export type EventRow = {
  id: string;
  name: string;
  starts_at: string | null;
  status: string;
  rumble_gender: string | null;
  roster_year: number | null;
  show_id: string | null;
};

export type ShowRow = {
  id: string;
  name: string;
  starts_at: string | null;
  status: string;
};

export type EntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
  gender: string | null;
  image_url: string | null;
  roster_year: number | null;
  event_id: string | null;
  is_custom: boolean;
  created_by: string | null;
  status: string | null;
};

export type RumblePick = {
  entrants: string[];
  final_four: string[];
  winner: string | null;
  entry_1: string | null;
  entry_2: string | null;
  entry_30: string | null;
  most_eliminations: string | null;
};

export type PicksPayload = {
  rumbles: Record<string, RumblePick>;
  match_picks: Record<string, string | null>;
  match_finish_picks: Record<
    string,
    { method: string | null; winner: string | null; loser: string | null }
  >;
};

export type RumbleEntryRow = {
  event_id: string;
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  eliminations_count: number;
};

export type MatchRow = {
  id: string;
  name: string;
  kind: string;
  match_type: string;
  status: string;
  winner_entrant_id: string | null;
  winner_side_id: string | null;
  finish_method: string | null;
  finish_winner_entrant_id: string | null;
  finish_loser_entrant_id: string | null;
};

export type MatchEntrantRow = {
  match_id: string;
  entrant_id: string;
  side_id: string | null;
};

export type MatchSideRow = {
  id: string;
  match_id: string;
  label: string | null;
};

export type EventActuals = {
  entrantSet: Set<string>;
  finalFourSet: Set<string>;
  winner: string | null;
  entry1: string | null;
  entry2: string | null;
  entry30: string | null;
  topElims: Set<string>;
  hasData: boolean;
};

export type SectionPoints = {
  entrants: number | null;
  finalFour: number | null;
  keyPicks: number | null;
};

export type RankInfo = {
  rank: number | null;
  total: number;
};

export type LockInfo = {
  label: string;
  detail: string;
};

export type EditSection =
  | "entrants"
  | "final_four"
  | "key_picks"
  | "matches"
  | null;
