import type { ScoringRules } from "./scoringRules";

export type PicksPayload = {
  entrants?: string[];
  final_four?: string[];
  winner?: string;
  entry_1?: string;
  entry_2?: string;
  entry_30?: string;
  iron_person?: string;
  most_eliminations?: string;
  eliminators?: Record<
    string,
    {
      entry_order?: Record<string, number | null>;
      elimination_order?: Record<string, number | null>;
      elimination_type?: Record<string, "pinfall" | "submission" | null>;
      eliminated_by?: Record<string, string | null>;
      winner_id?: string | null;
      most_eliminations?: string | null;
    }
  >;
  question_picks?: Record<string, string | null>;
  match_picks?: Record<string, string | null>;
  match_confidence_picks?: Record<string, number | null>;
  match_finish_picks?: Record<
    string,
    { method: string | null; winner: string | null; loser: string | null }
  >;
  match_length_picks?: Record<string, "sprint" | "standard" | "epic" | null>;
  match_interference_picks?: Record<string, "yes" | "no" | null>;
  blind_gauntlet_picks?: Record<
    string,
    {
      survival: boolean | null;
      entrant_ids: string[];
      final_entrant_id: string | null;
    }
  >;
};

export type RumbleEntryRow = {
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  eliminations_count: number;
  is_confirmed?: boolean;
};

export type MatchRow = {
  id: string;
  match_type?: string | null;
  winner_entrant_id: string | null;
  winner_side_id: string | null;
  finish_method: string | null;
  finish_winner_entrant_id: string | null;
  finish_loser_entrant_id: string | null;
  match_length?: string | null;
  match_interference?: string | null;
  gauntlet_survival_result?: boolean | null;
  gauntlet_final_entrant_id?: string | null;
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
  image_url?: string | null;
};

export type GauntletActualEntrantRow = {
  match_id: string;
  entrant_id: string;
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

export type EliminatorRow = {
  id: string;
  winner_entrant_id: string | null;
};

export type ShowQuestionRow = {
  id: string;
  correct_answer?: string | null;
};

const getEliminationKey = (entry: RumbleEntryRow) =>
  entry.eliminated_at ? new Date(entry.eliminated_at).getTime() : Number.MAX_SAFE_INTEGER;

export const calculateScore = (
  payload: PicksPayload,
  rumbleEntries: RumbleEntryRow[],
  rules: ScoringRules,
  matches: MatchRow[] = [],
  matchEntrants: MatchEntrantRow[] = [],
  matchSides: MatchSideRow[] = [],
  options?: { ironPersonId?: string | null; useConfidencePoints?: boolean },
  eliminatorEntries: EliminatorEntryRow[] = [],
  eliminatorEliminations: EliminatorEliminationRow[] = [],
  eliminators: EliminatorRow[] = [],
  questions: ShowQuestionRow[] = [],
  gauntletActualEntrants: GauntletActualEntrantRow[] = []
) => {
  const breakdown: Record<string, number> = {};
  let points = 0;

  const totalEntries = rumbleEntries.length;
  const remainingCount = rumbleEntries.filter((entry) => !entry.eliminated_at).length;
  const finalFourReady = totalEntries >= 4 && remainingCount <= 4;
  const winnerReady = totalEntries >= 30 && remainingCount === 1;
  const ironReady = winnerReady;
  const mostElimsReady = winnerReady;
  const entrantIds = new Set(
    rumbleEntries
      .filter((entry) => !entry.is_confirmed)
      .map((entry) => entry.entrant_id)
  );
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
  breakdown.final_four = finalFourReady
    ? guessedFinalFour.length * rules.final_four
    : 0;
  points += breakdown.final_four;

  const winners = rumbleEntries.filter((entry) => !entry.eliminated_at);
  const actualWinner = winnerReady ? winners[0].entrant_id : null;
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

  const ironEntrant = ironReady
    ? options?.ironPersonId ??
      [...rumbleEntries]
        .filter((entry) => entry.eliminated_at)
        .sort(
          (a, b) =>
            new Date(b.eliminated_at as string).getTime() -
            new Date(a.eliminated_at as string).getTime()
        )[0]?.entrant_id ??
      null
    : null;
  breakdown.iron_person =
    ironReady && ironEntrant && payload.iron_person === ironEntrant
      ? rules.iron_person
      : 0;
  points += breakdown.iron_person;

  const maxEliminations = rumbleEntries.reduce((max, entry) => {
    return Math.max(max, entry.eliminations_count ?? 0);
  }, 0);
  const topEliminators = rumbleEntries
    .filter((entry) => entry.eliminations_count === maxEliminations)
    .map((entry) => entry.entrant_id);
  breakdown.most_eliminations =
    mostElimsReady &&
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
  const matchConfidencePicks = payload.match_confidence_picks ?? {};
  const matchFinishPicks = payload.match_finish_picks ?? {};
  const matchLengthPicks = payload.match_length_picks ?? {};
  const matchInterferencePicks = payload.match_interference_picks ?? {};
  const blindGauntletPicks = payload.blind_gauntlet_picks ?? {};
  const entrantCountByMatch = matchEntrants.reduce((map, item) => {
    map[item.match_id] = (map[item.match_id] ?? 0) + 1;
    return map;
  }, {} as Record<string, number>);
  const matchPoints = matches.reduce((total, match) => {
    const pick = matchPicks[match.id];
    if (match.match_type === "blind_gauntlet") return total;
    if (!match.winner_side_id || !pick) return total;
    const allowed = matchSideSet[match.id];
    if (allowed && !allowed.has(pick)) return total;
    if (pick !== match.winner_side_id) return total;
    if (!options?.useConfidencePoints) {
      return total + rules.match_winner;
    }
    const confidence = matchConfidencePicks[match.id];
    return Number.isInteger(confidence) && (confidence ?? 0) > 0
      ? total + (confidence as number)
      : total;
  }, 0);

  const matchFinishPoints = matches.reduce((total, match) => {
    if (match.match_type === "blind_gauntlet") return total;
    const entrantCount = entrantCountByMatch[match.id] ?? 0;
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
      pick.method === match.finish_method &&
      entrantCount > 2
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
  const matchLengthPoints = matches.reduce((total, match) => {
    const pick = matchLengthPicks[match.id];
    if (!match.match_length || !pick) return total;
    return pick === match.match_length ? total + rules.match_length : total;
  }, 0);
  breakdown.match_length = matchLengthPoints;
  const matchInterferencePoints = matches.reduce((total, match) => {
    const pick = matchInterferencePicks[match.id];
    if (!match.match_interference || !pick) return total;
    return pick === match.match_interference
      ? total + rules.match_interference
      : total;
  }, 0);
  breakdown.match_interference = matchInterferencePoints;
  points += matchPoints;
  points += matchFinishPoints;
  points += matchLengthPoints;
  points += matchInterferencePoints;

  const gauntletActualByMatch = gauntletActualEntrants.reduce((map, row) => {
    if (!map[row.match_id]) {
      map[row.match_id] = new Set();
    }
    map[row.match_id].add(row.entrant_id);
    return map;
  }, {} as Record<string, Set<string>>);

  const blindGauntletPoints = matches.reduce((total, match) => {
    if (match.match_type !== "blind_gauntlet") return total;
    const pick = blindGauntletPicks[match.id];
    if (!pick) return total;
    let subtotal = 0;
    if (
      typeof match.gauntlet_survival_result === "boolean" &&
      pick.survival === match.gauntlet_survival_result
    ) {
      subtotal += rules.blind_gauntlet_survival;
    }
    const actualEntrants = gauntletActualByMatch[match.id] ?? new Set();
    (pick.entrant_ids ?? []).forEach((entrantId) => {
      subtotal += actualEntrants.has(entrantId)
        ? rules.blind_gauntlet_entrant_correct
        : rules.blind_gauntlet_entrant_incorrect;
    });
    if (
      match.gauntlet_final_entrant_id &&
      pick.final_entrant_id === match.gauntlet_final_entrant_id &&
      (pick.entrant_ids ?? []).includes(pick.final_entrant_id)
    ) {
      subtotal += rules.blind_gauntlet_final_entrant;
    }
    return total + subtotal;
  }, 0);

  breakdown.blind_gauntlet = blindGauntletPoints;
  points += blindGauntletPoints;

  const eliminatorEntriesById = eliminatorEntries.reduce((map, entry) => {
    if (!map[entry.eliminator_id]) {
      map[entry.eliminator_id] = [];
    }
    map[entry.eliminator_id].push(entry);
    return map;
  }, {} as Record<string, EliminatorEntryRow[]>);
  const eliminatorElimsById = eliminatorEliminations.reduce((map, entry) => {
    if (!map[entry.eliminator_id]) {
      map[entry.eliminator_id] = [];
    }
    map[entry.eliminator_id].push(entry);
    return map;
  }, {} as Record<string, EliminatorEliminationRow[]>);
  const eliminatorPicks = payload.eliminators ?? {};
  const eliminatorIds = new Set([
    ...Object.keys(eliminatorPicks),
    ...Object.keys(eliminatorEntriesById),
  ]);
  const eliminatorWinnerById = eliminators.reduce((map, row) => {
    map[row.id] = row.winner_entrant_id;
    return map;
  }, {} as Record<string, string | null>);

  let eliminatorEntryPoints = 0;
  let eliminatorElimOrderPoints = 0;
  let eliminatorElimTypePoints = 0;
  let eliminatorElimByPoints = 0;
  let eliminatorMostElimsPoints = 0;
  let eliminatorWinnerPoints = 0;

  eliminatorIds.forEach((eliminatorId) => {
    const entries = eliminatorEntriesById[eliminatorId] ?? [];
    if (entries.length === 0) return;
    const entryReady = entries.every((entry) => entry.entry_order);
    const pick = eliminatorPicks[eliminatorId];
    if (pick && entryReady) {
      const entryOrder = pick.entry_order ?? {};
      entries.forEach((entry) => {
        if (
          entry.entry_order &&
          entryOrder[entry.entrant_id] === entry.entry_order
        ) {
          eliminatorEntryPoints += rules.eliminator_entry_order;
        }
      });
    }
    const eliminations = eliminatorElimsById[eliminatorId] ?? [];
    const eliminationReady =
      eliminations.length === Math.max(entries.length - 1, 0);
    if (pick && eliminationReady) {
      const elimOrder = pick.elimination_order ?? {};
      const elimType = pick.elimination_type ?? {};
      const elimBy = pick.eliminated_by ?? {};
      eliminations.forEach((elim) => {
        if (
          elimOrder[elim.eliminated_entrant_id] === elim.elimination_order
        ) {
          eliminatorElimOrderPoints += rules.eliminator_elimination_order;
        }
        if (elimType[elim.eliminated_entrant_id] === elim.elimination_type) {
          eliminatorElimTypePoints += rules.eliminator_elimination_type;
        }
        if (
          elimBy[elim.eliminated_entrant_id] === elim.eliminated_by_entrant_id
        ) {
          eliminatorElimByPoints += rules.eliminator_eliminated_by;
        }
      });
      if (pick.most_eliminations) {
        const eliminationsByEntrant = eliminations.reduce((map, row) => {
          if (!row.eliminated_by_entrant_id) return map;
          map[row.eliminated_by_entrant_id] =
            (map[row.eliminated_by_entrant_id] ?? 0) + 1;
          return map;
        }, {} as Record<string, number>);
        const maxElims = Math.max(0, ...Object.values(eliminationsByEntrant));
        const topElims = Object.keys(eliminationsByEntrant).filter(
          (id) => eliminationsByEntrant[id] === maxElims
        );
        if (topElims.includes(pick.most_eliminations)) {
          eliminatorMostElimsPoints += rules.eliminator_most_eliminations;
        }
      }
    }
    const actualWinner = eliminatorWinnerById[eliminatorId];
    if (pick?.winner_id && actualWinner && pick.winner_id === actualWinner) {
      eliminatorWinnerPoints += rules.eliminator_winner;
    }
  });

  breakdown.eliminator_entry_order = eliminatorEntryPoints;
  breakdown.eliminator_elimination_order = eliminatorElimOrderPoints;
  breakdown.eliminator_elimination_type = eliminatorElimTypePoints;
  breakdown.eliminator_eliminated_by = eliminatorElimByPoints;
  breakdown.eliminator_most_eliminations = eliminatorMostElimsPoints;
  breakdown.eliminator_winner = eliminatorWinnerPoints;
  points += eliminatorEntryPoints;
  points += eliminatorElimOrderPoints;
  points += eliminatorElimTypePoints;
  points += eliminatorElimByPoints;
  points += eliminatorMostElimsPoints;
  points += eliminatorWinnerPoints;

  const questionPicks = payload.question_picks ?? {};
  const questionPoints = questions.reduce((total, question) => {
    if (!question.correct_answer) return total;
    return questionPicks[question.id] === question.correct_answer
      ? total + rules.question_correct
      : total;
  }, 0);
  breakdown.questions = questionPoints;
  points += questionPoints;

  return { points, breakdown };
};
