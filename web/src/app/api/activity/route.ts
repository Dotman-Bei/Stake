import { NextResponse } from "next/server";
import { getActivityWire } from "@/lib/indexer";
import { stakeAddress } from "@/lib/chains";

export const dynamic = "force-dynamic";

/** Indexed StakeMarkets events (read cache). Verify any figure against the contract or explorer. */
export async function GET() {
  if (!stakeAddress) return NextResponse.json({ error: "contract-not-configured" }, { status: 503 });
  try {
    return NextResponse.json(await getActivityWire(), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: "rpc-unavailable", detail: (err as Error).message.slice(0, 200) }, { status: 502 });
  }
}
