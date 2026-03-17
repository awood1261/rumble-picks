export type ScoringRules = {
  entrants: number;
  final_four: number;
  winner: number;
  entry_1: number;
  entry_2: number;
  entry_30: number;
  iron_person: number;
  most_eliminations: number;
  eliminator_entry_order: number;
  eliminator_elimination_order: number;
  eliminator_elimination_type: number;
  eliminator_eliminated_by: number;
  eliminator_most_eliminations: number;
  eliminator_winner: number;
  match_winner: number;
  match_finish_method: number;
  match_finish_winner: number;
  match_finish_loser: number;
  match_length: number;
  match_interference: number;
  question_correct: number;
};

export const scoringRules: ScoringRules = {
  entrants: 1,
  final_four: 6,
  winner: 12,
  entry_1: 6,
  entry_2: 6,
  entry_30: 5,
  iron_person: 6,
  most_eliminations: 6,
  eliminator_entry_order: 2,
  eliminator_elimination_order: 2,
  eliminator_elimination_type: 1,
  eliminator_eliminated_by: 2,
  eliminator_most_eliminations: 3,
  eliminator_winner: 10,
  match_winner: 5,
  match_finish_method: 2,
  match_finish_winner: 2,
  match_finish_loser: 2,
  match_length: 2,
  match_interference: 2,
  question_correct: 5,
};
