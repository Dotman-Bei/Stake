import type { ReactNode } from "react";
import type { Market } from "@/lib/markets";
import { MarketCard } from "./MarketCard";

export function BoardHeader({ eyebrow, title, feed, children }: {
  eyebrow: string;
  title: string;
  feed?: { live: boolean; label: string };
  children?: ReactNode;
}) {
  return (
    <div className="board-header">
      <div>
        <div className="label eyebrow">{eyebrow}</div>
        <h1 className="board-title">{title}</h1>
      </div>
      <div className="board-tools">
        {feed && (
          <span className={`feed-chip${feed.live ? "" : " off"}`} role="status">
            <span className="dot" aria-hidden="true" />
            {feed.label}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export function MarketGrid({ markets, now, participants, mine }: {
  markets: Market[];
  now: number;
  participants: Map<number, string[]>;
  mine: Map<number, number>;
}) {
  return (
    <section className="market-grid" aria-label="Markets">
      {markets.map((m) => (
        <MarketCard key={m.id} market={m} now={now} participants={participants.get(m.id) ?? []} mySide={mine.get(m.id)} />
      ))}
    </section>
  );
}
