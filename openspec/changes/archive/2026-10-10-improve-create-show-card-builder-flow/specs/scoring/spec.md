## ADDED Requirements

### Requirement: Planned Match Slots Do Not Affect Scoring
Application scoring and scoreboards SHALL ignore planned match count and virtual planned match slots.

#### Scenario: Scoreboard calculates show with planned slots
- **WHEN** a scoreboard is calculated for a show that has a planned match count
- **THEN** scoring uses only real event, match, eliminator, show-question, result, and submitted pick records
- **AND** virtual planned slots do not contribute points, result completeness, rank order, or score breakdown values

#### Scenario: Planned count changes after scores exist
- **WHEN** an authorized admin changes planned match count for a show with existing picks or scores
- **THEN** the scoring result for existing real records remains unchanged
- **AND** score recalculation does not add or remove points solely because planned count changed

#### Scenario: Results workflow sees only real records
- **WHEN** an authorized admin enters results for a show with virtual planned slots
- **THEN** result-entry controls operate only on real configured match, event, eliminator, and show-question records
- **AND** virtual planned slots do not require results and do not make result completeness fail
