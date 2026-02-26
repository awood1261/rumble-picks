const blockedTerms = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "nigger",
  "faggot",
  "asshole",
  "dick",
  "pussy",
  "rape",
  "whore",
  "slut",
];

const leetMap: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
};

const normalize = (value: string) => {
  const lowered = value.toLowerCase().replace(/[0134578]/g, (char) => leetMap[char]);
  return lowered.replace(/[^a-z]/g, " ");
};

export const containsProfanity = (value: string) => {
  const normalized = normalize(value);
  const compact = normalized.replace(/\s+/g, "");
  return blockedTerms.some((term) => {
    const boundaryMatch = new RegExp(`\\b${term}\\b`, "i").test(normalized);
    return boundaryMatch || compact.includes(term);
  });
};
