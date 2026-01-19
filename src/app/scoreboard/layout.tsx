import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scoreboard",
};

export default function ScoreboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
