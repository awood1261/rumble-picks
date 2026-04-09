import type { PremiumMapNodeState } from "./premiumMode";

export type PremiumMapLayoutZone = {
  slot: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PremiumMapMatchNode = {
  id: string;
  matchId: string;
  title: string;
  type: "match";
  left: number;
  top: number;
  width: number;
  height: number;
  status: PremiumMapNodeState;
};

export const PREMIUM_MAP_LAYOUT_ZONES: PremiumMapLayoutZone[] = [
  { slot: 0, left: 14.6, top: 16.6, width: 33.4, height: 17.7 },
  { slot: 1, left: 48.2, top: 16.6, width: 33.4, height: 17.7 },
  { slot: 2, left: 14.6, top: 35.9, width: 33.4, height: 17.7 },
  { slot: 3, left: 48.2, top: 35.9, width: 33.4, height: 17.7 },
  { slot: 4, left: 14.6, top: 55.1, width: 33.4, height: 17.7 },
  { slot: 5, left: 48.2, top: 55.1, width: 33.4, height: 17.7 },
];
