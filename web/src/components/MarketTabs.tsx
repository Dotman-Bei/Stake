"use client";

import { TABS, type TabKey } from "@/lib/markets";

export function MarketTabs({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav className="market-tabs" aria-label="Market filters">
      {TABS.map((t) => (
        <button key={t.key} aria-pressed={active === t.key} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
