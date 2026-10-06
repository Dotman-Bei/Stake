"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAccount, useBalance } from "wagmi";
import { activeChain } from "@/lib/chains";
import { bot } from "@/lib/format";
import { SearchIcon, StakeMark, StakeWordmark } from "./Icons";
import { WalletButton } from "./WalletButton";

function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => { setValue(params.get("q") ?? ""); }, [params]);

  const update = (q: string) => {
    setValue(q);
    const next = new URLSearchParams(pathname === "/markets" ? params.toString() : "");
    if (q) next.set("q", q); else next.delete("q");
    const url = `/markets${next.toString() ? `?${next}` : ""}`;
    if (pathname === "/markets") router.replace(url, { scroll: false });
    else router.push(url);
  };

  return (
    <label className="search-box">
      <SearchIcon />
      <span className="sr-only">Search markets</span>
      <input type="search" placeholder="Search markets..." value={value} onChange={(e) => update(e.target.value)} />
    </label>
  );
}

/** Real BOT balance when connected; otherwise the network name (never a fake balance, §9). */
function BalanceChip() {
  const { address, isConnected, chainId } = useAccount();
  const { data } = useBalance({ address, chainId: activeChain.id, query: { enabled: isConnected, refetchInterval: 15_000 } });
  if (isConnected && chainId === activeChain.id && data) {
    return (
      <span className="balance-chip mono-num" title={`${activeChain.name} balance`}>
        {bot(data.value)} BOT
      </span>
    );
  }
  return (
    <span className="balance-chip network" title="Network">
      {activeChain.name}
    </span>
  );
}

export function Topbar({ onHowItWorks }: { onHowItWorks: () => void }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="STAKE home">
        <StakeMark className="brand-mark" />
        <StakeWordmark className="brand-name" />
      </Link>
      <Suspense fallback={<div className="search-box" />}>
        <SearchBox />
      </Suspense>
      <div className="topbar-actions">
        <button className="link-button" onClick={onHowItWorks}>
          <span className="full-label">How it works?</span>
          <span className="short">How?</span>
        </button>
        <BalanceChip />
        <WalletButton />
      </div>
    </header>
  );
}
