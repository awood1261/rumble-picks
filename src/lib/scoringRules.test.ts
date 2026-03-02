import { describe, expect, it } from "vitest";
import { scoringRules } from "./scoringRules";

describe("scoringRules", () => {
  it("includes eliminator winner and eliminated-by points", () => {
    expect(scoringRules.eliminator_winner).toBe(10);
    expect(scoringRules.eliminator_eliminated_by).toBe(2);
  });
});
