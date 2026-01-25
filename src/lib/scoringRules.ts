export type ScoringRules = {
  entrants: number;
  final_four: number;
  winner: number;
  entry_1: number;
  entry_2: number;
  entry_30: number;
  most_eliminations: number;
  match_winner: number;
};

export const scoringRules: ScoringRules = {
  entrants: 1,
  final_four: 6,
  winner: 12,
  entry_1: 6,
  entry_2: 6,
  entry_30: 5,
  most_eliminations: 6,
  match_winner: 5,
};
