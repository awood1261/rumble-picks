export const getKeyPickFields = (gender?: string | null) =>
  [
    { label: "Winner", key: "winner" },
    { label: "Entry #1", key: "entry_1" },
    { label: "Entry #2", key: "entry_2" },
    { label: "Entry #30", key: "entry_30" },
    {
      label: gender === "women" ? "Iron woman" : "Iron man",
      key: "iron_person",
    },
    { label: "Most eliminations", key: "most_eliminations" },
  ] as const;
