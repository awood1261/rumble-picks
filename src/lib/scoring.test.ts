import { describe, expect, it } from "vitest";
import { calculateScore } from "./scoring";
import { scoringRules } from "./scoringRules";

describe("calculateScore", () => {
  it("awards eliminator winner points when the pick matches the result", () => {
    const payload = {
      eliminators: {
        elim1: {
          winner_id: "entrant-1",
        },
      },
    };

    const result = calculateScore(
      payload,
      [],
      scoringRules,
      [],
      [],
      [],
      undefined,
      [],
      [],
      [{ id: "elim1", winner_entrant_id: "entrant-1" }]
    );

    expect(result.breakdown.eliminator_winner).toBe(
      scoringRules.eliminator_winner
    );
    expect(result.points).toBe(scoringRules.eliminator_winner);
  });
});
