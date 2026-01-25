import type { ScoringRules } from "./scoringRules";

export type PicksPayload = {
  entrants?: string[];
  final_four?: string[];
  winner?: string;
  entry_1?: string;
  entry_2?: string;
  entry_30?: string;
  most_eliminations?: string;
  match_picks?: Record<string, string | null>;
  match_finish_picks?: Record<
    string,
    { method: string | null; winner: string | null; loser: string | null }
  >;
};

export type RumbleEntryRow = {
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  eliminations_count: number;
};

export type MatchRow = {
  id: string;
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

const getEliminationKey = (entry: RumbleEntryRow) =>
  entry.eliminated_at ? new Date(entry.eliminated_at).getTime() : Number.MAX_SAFE_INTEGER;

export const calculateScore = (
  payload: PicksPayload,
  rumbleEntries: RumbleEntryRow[],
  rules: ScoringRules,
  matches: MatchRow[] = [],
  matchEntrants: MatchEntrantRow[] = [],
  matchSides: MatchSideRow[] = []
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

  const matchSideSet = matchSides.reduce((map, side) => {
    if (!map[side.match_id]) {
      map[side.match_id] = new Set();
    }
    map[side.match_id].add(side.id);
    return map;
  }, {} as Record<string, Set<string>>);

  const matchPicks = payload.match_picks ?? {};
  const matchFinishPicks = payload.match_finish_picks ?? {};
  const entrantCountByMatch = matchEntrants.reduce((map, item) => {
    map[item.match_id] = (map[item.match_id] ?? 0) + 1;
    return map;
  }, {} as Record<string, number>);
  const matchPoints = matches.reduce((total, match) => {
    const pick = matchPicks[match.id];
    if (!match.winner_side_id || !pick) return total;
    const allowed = matchSideSet[match.id];
    if (allowed && !allowed.has(pick)) return total;
    return pick === match.winner_side_id ? total + rules.match_winner : total;
  }, 0);

  const matchFinishPoints = matches.reduce((total, match) => {
    const entrantCount = entrantCountByMatch[match.id] ?? 0;
    if (entrantCount <= 2) return total;
    if (!match.finish_method) return total;
    const pick = matchFinishPicks[match.id];
    if (!pick) return total;
    let subtotal = 0;
    if (pick.method && pick.method === match.finish_method) {
      subtotal += rules.match_finish_method;
    }
    if (
      (match.finish_method === "pinfall" ||
        match.finish_method === "submission") &&
      pick.method === match.finish_method
    ) {
      if (
        match.finish_winner_entrant_id &&
        pick.winner === match.finish_winner_entrant_id
      ) {
        subtotal += rules.match_finish_winner;
      }
      if (
        match.finish_loser_entrant_id &&
        pick.loser === match.finish_loser_entrant_id
      ) {
        subtotal += rules.match_finish_loser;
      }
    }
    return total + subtotal;
  }, 0);

  breakdown.matches = matchPoints;
  breakdown.match_finish_method = matchFinishPoints;
  points += matchPoints;
  points += matchFinishPoints;

  return { points, breakdown };
};
