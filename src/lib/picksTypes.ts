export type EventRow = {
  id: string;
  name: string;
  status: string;
  rumble_gender: string | null;
  roster_year: number | null;
  show_id: string | null;
  iron_person_entrant_id?: string | null;
  order_index?: number | null;
};

export type ShowQuestionRow = {
  id: string;
  show_id: string | null;
  image_url: string | null;
  question: string;
  answers: string[];
  correct_answer?: string | null;
  order_index?: number | null;
  created_at?: string;
};

export type EliminatorRow = {
  id: string;
  name: string;
  status: string;
  roster_year: number | null;
  roster_gender: string | null;
  entrant_limit: number;
  show_id: string | null;
  order_index?: number | null;
  winner_entrant_id?: string | null;
};

export type ShowRow = {
  id: string;
  name: string;
  tagline?: string | null;
  image_url: string | null;
  promotion_id: string | null;
  starts_at: string | null;
  status: string;
  requires_email_registration?: boolean | null;
  lock_picks_at_start?: boolean | null;
  is_featured_play_show?: boolean | null;
  is_over?: boolean | null;
};

export type PromotionRow = {
  id: string;
  name: string;
  image_url: string | null;
};

export type EntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
  gender: string | null;
  image_url: string | null;
  logo_url: string | null;
  sprite_neutral_url?: string | null;
  sprite_victory_url?: string | null;
  sprite_defeat_url?: string | null;
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
  iron_person: string | null;
  most_eliminations: string | null;
};

export type EliminatorPick = {
  entry_order: Record<string, number | null>;
  elimination_order: Record<string, number | null>;
  elimination_type: Record<string, "pinfall" | "submission" | null>;
  eliminated_by: Record<string, string | null>;
  winner_id: string | null;
  most_eliminations: string | null;
};

export type PicksPayload = {
  rumbles: Record<string, RumblePick>;
  eliminators?: Record<string, EliminatorPick>;
  question_picks?: Record<string, string | null>;
  match_picks: Record<string, string | null>;
  match_finish_picks: Record<
    string,
    { method: string | null; winner: string | null; loser: string | null }
  >;
  match_length_picks?: Record<string, "sprint" | "standard" | "epic" | null>;
  match_interference_picks?: Record<string, "yes" | "no" | null>;
};

export type RumbleEntryRow = {
  event_id: string;
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  eliminations_count: number;
  is_confirmed?: boolean;
};

export type EliminatorEntryRow = {
  eliminator_id: string;
  entrant_id: string;
  entry_order: number | null;
};

export type EliminatorEliminationRow = {
  eliminator_id: string;
  eliminated_entrant_id: string;
  eliminated_by_entrant_id: string | null;
  elimination_type: "pinfall" | "submission";
  elimination_order: number;
};

export type MatchRow = {
  id: string;
  name: string;
  kind: string;
  match_type: string;
  status: string;
  order_index?: number | null;
  is_main_event?: boolean | null;
  is_championship?: boolean | null;
  championship_name?: string | null;
  championship_image_url?: string | null;
  champion_side_id?: string | null;
  winner_entrant_id: string | null;
  winner_side_id: string | null;
  finish_method: string | null;
  finish_winner_entrant_id: string | null;
  finish_loser_entrant_id: string | null;
  match_length?: string | null;
  match_interference?: string | null;
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
  confirmedSet?: Set<string>;
  finalFourSet: Set<string>;
  winner: string | null;
  entry1: string | null;
  entry2: string | null;
  entry30: string | null;
  ironPerson: string | null;
  topElims: Set<string>;
  hasData: boolean;
  totalEntries: number;
  remainingCount: number;
  finalFourReady: boolean;
  winnerReady: boolean;
  entry1Ready: boolean;
  entry2Ready: boolean;
  entry30Ready: boolean;
  ironPersonReady: boolean;
  mostElimsReady: boolean;
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
