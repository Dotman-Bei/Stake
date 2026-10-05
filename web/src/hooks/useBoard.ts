"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useAggregate } from "./useStake";

/** Everything a market grid needs: markets, per-market participants, and the wallet's own sides. */
export function useBoard() {
  const { address } = useAccount();
  const { markets, activity, agg } = useAggregate();

  const { participants, mine } = useMemo(() => {
    const participants = new Map<number, string[]>();
    const mine = new Map<number, number>();
    const me = address?.toLowerCase();
    if (agg) {
      for (const [id, holders] of agg.holdings) {
        // largest positions first
        participants.set(id, [...holders.entries()].sort((a, b) => (b[1].amount > a[1].amount ? 1 : -1)).map(([a]) => a));
        if (me && holders.has(me)) mine.set(id, holders.get(me)!.side);
      }
    }
    return { participants, mine };
  }, [agg, address]);

  return { markets, activity, agg, participants, mine };
}
