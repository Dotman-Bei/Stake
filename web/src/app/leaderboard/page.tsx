import type { Metadata } from "next";
import { LeaderboardView } from "./LeaderboardView";

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return <LeaderboardView />;
}
