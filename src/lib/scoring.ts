import type { ScoringRules } from "./scoringRules";

export type PicksPayload = {
  entrants?: string[];
  final_four?: string[];
  winner?: string;
  entry_1?: string;
  entry_2?: string;
  entry_30?: string;
  most_eliminations?: string;
};

export type RumbleEntryRow = {
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  eliminations_count: number;
};

const getEliminationKey = (entry: RumbleEntryRow) =>
  entry.eliminated_at ? new Date(entry.eliminated_at).getTime() : Number.MAX_SAFE_INTEGER;

export const calculateScore = (
  payload: PicksPayload,
  rumbleEntries: RumbleEntryRow[],
  rules: ScoringRules
) => {
  const breakdown: Record<string, number> = {};
  let points = 0;

  const entrantIds = new Set(rumbleEntries.map((entry) => entry.entrant_id));
  const guessedEntrants = (payload.entrants ?? []).filter((id) =>
    entrantIds.has(id)
  );
  breakdown.entrants = guessedEntrants.length * rules.entrants;
  points += breakdown.entrants;

  const actualFinalFour = [...rumbleEntries]
    .sort((a, b) => getEliminationKey(b) - getEliminationKey(a))
    .slice(0, 4)
    .map((entry) => entry.entrant_id);
  const finalFourSet = new Set(actualFinalFour);
  const guessedFinalFour = (payload.final_four ?? []).filter((id) =>
    finalFourSet.has(id)
  );
  breakdown.final_four = guessedFinalFour.length * rules.final_four;
  points += breakdown.final_four;

  const winners = rumbleEntries.filter((entry) => !entry.eliminated_at);
  const actualWinner =
    winners.length === 1 ? winners[0].entrant_id : null;
  breakdown.winner =
    actualWinner && payload.winner === actualWinner ? rules.winner : 0;
  points += breakdown.winner;

  const entryOne = rumbleEntries.find((entry) => entry.entry_number === 1);
  breakdown.entry_1 =
    entryOne && payload.entry_1 === entryOne.entrant_id ? rules.entry_1 : 0;
  points += breakdown.entry_1;

  const entryTwo = rumbleEntries.find((entry) => entry.entry_number === 2);
  breakdown.entry_2 =
    entryTwo && payload.entry_2 === entryTwo.entrant_id ? rules.entry_2 : 0;
  points += breakdown.entry_2;

  const entryThirty = rumbleEntries.find((entry) => entry.entry_number === 30);
  breakdown.entry_30 =
    entryThirty && payload.entry_30 === entryThirty.entrant_id
      ? rules.entry_30
      : 0;
  points += breakdown.entry_30;

  const maxEliminations = rumbleEntries.reduce((max, entry) => {
    return Math.max(max, entry.eliminations_count ?? 0);
  }, 0);
  const topEliminators = rumbleEntries
    .filter((entry) => entry.eliminations_count === maxEliminations)
    .map((entry) => entry.entrant_id);
  breakdown.most_eliminations =
    payload.most_eliminations &&
    topEliminators.includes(payload.most_eliminations)
      ? rules.most_eliminations
      : 0;
  points += breakdown.most_eliminations;

  return { points, breakdown };
};
