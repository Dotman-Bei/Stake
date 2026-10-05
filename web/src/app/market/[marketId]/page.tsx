import type { Metadata } from "next";
import { MarketDetailView } from "./MarketDetailView";

type Props = { params: Promise<{ marketId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { marketId } = await params;
  return { title: `Market #${marketId}` };
}

export default async function MarketPage({ params }: Props) {
  const { marketId } = await params;
  return <MarketDetailView marketId={marketId} />;
}
