import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketsView } from "./MarketsView";

export const metadata: Metadata = { title: "Markets" };

export default function MarketsPage() {
  return (
    <Suspense>
      <MarketsView />
    </Suspense>
  );
}
