import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Picks",
};

export default function ScoreboardUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
