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

const EMPTY: string[] = [];

/**
 * Per-card clock: cards more than an hour from their next transition only need minute
 * precision, so the shared 1s tick doesn't re-render the whole grid every second.
 */
function cardClock(m: Market, now: number): number {
  if (!now) return 0;
  const next = now < m.openTime ? m.openTime : m.closeTime;
  return next - now > 3600 ? now - (now % 60) : now;
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
        <MarketCard key={m.id} market={m} now={cardClock(m, now)} participants={participants.get(m.id) ?? EMPTY} mySide={mine.get(m.id)} />
      ))}
    </section>
  );
}
