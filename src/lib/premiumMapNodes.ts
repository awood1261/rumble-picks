export type PremiumDemoNode = {
  id: string;
  title: string;
  type: "match" | "question";
  left: number;
  top: number;
  width: number;
  height: number;
  status: "unanswered" | "active" | "answered";
};

export const PREMIUM_DEMO_NODES: PremiumDemoNode[] = [
  {
    id: "gallery-1",
    title: "Opening Match",
    type: "match",
    left: 14.6,
    top: 16.6,
    width: 33.4,
    height: 17.7,
    status: "answered",
  },
  {
    id: "gallery-2",
    title: "Bonus Question",
    type: "question",
    left: 48.2,
    top: 16.6,
    width: 33.4,
    height: 17.7,
    status: "active",
  },
  {
    id: "gallery-3",
    title: "Tag Match",
    type: "match",
    left: 14.6,
    top: 35.9,
    width: 33.4,
    height: 17.7,
    status: "unanswered",
  },
  {
    id: "gallery-4",
    title: "Rivalry Match",
    type: "match",
    left: 48.2,
    top: 35.9,
    width: 33.4,
    height: 17.7,
    status: "unanswered",
  },
  {
    id: "gallery-5",
    title: "Semi Main Event",
    type: "match",
    left: 14.6,
    top: 55.1,
    width: 33.4,
    height: 17.7,
    status: "unanswered",
  },
  {
    id: "gallery-6",
    title: "Main Event",
    type: "match",
    left: 48.2,
    top: 55.1,
    width: 33.4,
    height: 17.7,
    status: "unanswered",
  },
];
