# Show With Matches Only — End‑to‑End Test Plan

Use this to verify a show that has **only matches** (no rumble events). Each step includes the expected result.

## Admin flow

1) **Create a show**  
- Action: Admin → Create show (name + start time) → Save  
- Expected: Toast confirms creation; new show appears in Show selector; it becomes active.

2) **Add a match (singles)**  
- Action: Matches tab → Expand “Add match” → enter name, type=Singles, roster year, roster gender → Add  
- Expected: Match appears in “Matches on this show”.

3) **Add participants + sides**  
- Action: Edit match → Add side(s) → Add participants to each side → Save participants  
- Expected: Participants list appears under match; Participants UI collapses with “Participants saved”.

4) **Add a tag match (or multi‑entrant)**  
- Action: Add match type=Tag/Triple/Fatal 4 Way → add sides + participants  
- Expected: Match appears with correct sides/entrants.

5) **Enter results (singles)**  
- Action: Select winning side → Set finish method (pin/sub/DQ) → Save finish  
- Expected: Toast confirms; finish method saved.

6) **Enter results (tag or multi‑entrant)**  
- Action: Select winning side → Set finish method → choose finish winner/loser (if pin/sub) → Save finish  
- Expected: Toast confirms; finish fields saved.

7) **Lock the show**  
- Action: Set start time in the past  
- Expected: Picks lock on user side.

---

## User flow

8) **Select show**  
- Action: Picks page → choose the show  
- Expected: No rumble sections shown; match picks visible.

9) **Make winner picks**  
- Action: Click side card per match  
- Expected: Selected state shown for the chosen side.

10) **Choose finish method (singles)**  
- Action: Pick finish method  
- Expected: Finish method saved in UI.

11) **Choose finish method + finish winner/loser (multi‑entrant)**  
- Action: Pick finish method; choose winner/loser (pin/sub only)  
- Expected: Winner/loser options limited to correct side; saved in UI.

12) **Save picks**  
- Action: Save match picks  
- Expected: Success state; picks persist on refresh.

13) **After lock time**  
- Action: Refresh picks page after show is locked  
- Expected: Picks are read‑only; scores/rank may appear after results are entered.

---

## Scoreboard flow

14) **Scoreboard shows show rankings**  
- Action: Scoreboard → select show  
- Expected: Leaderboard displays users + points (even without rumble events).

15) **Public picks page (per user)**  
- Action: Click a user on scoreboard  
- Expected: Match picks and finish details shown; no rumble sections.

16) **Finish scoring visible**  
- Action: Confirm finish method points for singles and multi‑entrant matches  
- Expected: Finish method scoring visible; winner/loser finish scoring only for multi‑entrant matches.
