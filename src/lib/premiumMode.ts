export const PREMIUM_ROUTES = {
  play: "/play/premium",
  picks: "/picks/premium",
} as const;

export const PREMIUM_AVATAR_OPTIONS = {
  skinTone: ["tone_1", "tone_2", "tone_3", "tone_4", "tone_5", "tone_6"],
  hairStyle: ["short_1", "short_2", "long_1", "long_2"],
  hairColor: ["black", "brown", "blonde", "red", "blue"],
  topStyle: ["tee_1", "jacket_1", "tank_1"],
  topColor: ["red", "blue", "black", "green", "white"],
  bottomStyle: ["pants_1", "shorts_1", "tights_1"],
  bottomColor: ["black", "blue", "red", "purple"],
  accessory: ["none", "glasses"],
} as const;

export type PremiumAvatarConfig = {
  skinTone: (typeof PREMIUM_AVATAR_OPTIONS.skinTone)[number];
  hairStyle: (typeof PREMIUM_AVATAR_OPTIONS.hairStyle)[number];
  hairColor: (typeof PREMIUM_AVATAR_OPTIONS.hairColor)[number];
  topStyle: (typeof PREMIUM_AVATAR_OPTIONS.topStyle)[number];
  topColor: (typeof PREMIUM_AVATAR_OPTIONS.topColor)[number];
  bottomStyle: (typeof PREMIUM_AVATAR_OPTIONS.bottomStyle)[number];
  bottomColor: (typeof PREMIUM_AVATAR_OPTIONS.bottomColor)[number];
  accessory: (typeof PREMIUM_AVATAR_OPTIONS.accessory)[number];
};

export const DEFAULT_PREMIUM_AVATAR_CONFIG: PremiumAvatarConfig = {
  skinTone: "tone_3",
  hairStyle: "short_1",
  hairColor: "brown",
  topStyle: "tee_1",
  topColor: "red",
  bottomStyle: "pants_1",
  bottomColor: "black",
  accessory: "none",
};

export type PremiumMapNodeType =
  | "event"
  | "eliminator"
  | "question"
  | "match";

export type PremiumMapNodeState = "unanswered" | "active" | "answered";
