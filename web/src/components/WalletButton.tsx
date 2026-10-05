"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { activeChain, addressUrl } from "@/lib/chains";
import { shortAddress } from "@/lib/format";
import { describeError } from "@/lib/errors";

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const connectors = useConnectors();
  const { connect, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"list" | "account">("list");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => { if (isConnected) setOpen(false); }, [isConnected]);

  // EIP-6963 wallets announce themselves; hide the generic fallback when real ones exist.
  const discovered = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
  const wallets = discovered.length ? discovered : connectors;
  const wrongChain = isConnected && chainId !== activeChain.id;

  if (wrongChain) {
    return (
      <div className="wallet">
        <button className="wallet-button warn" onClick={() => switchChain({ chainId: activeChain.id })} disabled={switching} title={switchError ? describeError(switchError) : undefined}>
          <span className="full-label">{switching ? "Switching…" : `Switch to ${activeChain.name}`}</span>
          <span className="short">Switch</span>
        </button>
      </div>
    );
  }

  const toggle = (m: "list" | "account") => { setMode(m); setOpen((o) => !o || mode !== m); };

  return (
    <div className="wallet" ref={ref}>
      <button
        className="wallet-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => toggle(isConnected ? "account" : "list")}
      >
        {isConnected && address ? (
          shortAddress(address)
        ) : (
          <>
            <span className="full-label">{isPending ? "Connecting…" : "Connect wallet"}</span>
            <span className="short">{isPending ? "…" : "Connect"}</span>
          </>
        )}
      </button>

      {open && (
        <div className="wallet-menu" role="menu">
          {mode === "account" && isConnected && address ? (
            <>
              <div className="wallet-menu-head">
                <div className="label">Connected · {activeChain.name}</div>
                <div className="mono-num" style={{ color: "var(--white)", marginTop: 4 }}>{shortAddress(address)}</div>
              </div>
              <Link role="menuitem" href="/profile" onClick={() => setOpen(false)}>My profile</Link>
              <button role="menuitem" onClick={() => { navigator.clipboard?.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? "Copied" : "Copy address"}
              </button>
              {addressUrl(address) && (
                <a role="menuitem" className="ext" href={addressUrl(address)!} target="_blank" rel="noreferrer">View on explorer</a>
              )}
              <button role="menuitem" onClick={() => { disconnect(); setMode("list"); setOpen(true); }}>Change wallet</button>
              <button role="menuitem" onClick={() => { disconnect(); setOpen(false); }}>Disconnect</button>
            </>
          ) : (
            <>
              <div className="wallet-menu-head"><div className="label">Choose a browser wallet</div></div>
              {wallets.map((c) => (
                <button role="menuitem" key={c.uid} onClick={() => connect({ connector: c, chainId: activeChain.id })} disabled={isPending}>
                  {c.icon ? <img src={c.icon} alt="" /> : null}
                  <span>{c.id === "injected" ? "Browser wallet" : c.name}</span>
                  {"rdns" in c && typeof c.rdns === "string" ? <span className="rdns">{c.rdns}</span> : null}
                </button>
              ))}
              {connectError && <div className="wallet-menu-note danger">{describeError(connectError)}</div>}
              {!discovered.length && (
                <div className="wallet-menu-note">
                  No wallet detected? Install an EVM browser wallet (MetaMask, Rabby, OKX). STAKE adds {activeChain.name} for you on connect.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
