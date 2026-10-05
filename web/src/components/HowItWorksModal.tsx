"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./Icons";

const STEPS = [
  {
    kicker: "Discover",
    title: "Pick a market",
    body: "Every market is one YES/NO question with a fixed deadline and a declared, deterministic resolution source. Most close within hours.",
    signal: "64% yes pool",
    metric: "Live market",
  },
  {
    kicker: "Decide",
    title: "Choose YES or NO",
    body: "Pick a side. The pool split shows where other predictors stand and what a win would pay right now.",
    signal: "YES",
    metric: "Side picked",
  },
  {
    kicker: "Commit",
    title: "Stake BOT on-chain",
    body: "Confirm one transaction. Your stake goes into the STAKE contract on BOT Chain and your position is recorded on-chain: fast, low-fee, verifiable.",
    signal: "5 BOT",
    metric: "Position recorded",
  },
  {
    kicker: "Settle",
    title: "Claim on settlement",
    body: "After close the resolver records the outcome on-chain with its evidence. Winners claim their share of the pool. If a market can't be resolved cleanly, everyone is refunded.",
    signal: "+7.8 BOT",
    metric: "Payout claimed",
  },
];

export function HowItWorksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    returnFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="how-title" tabIndex={-1} ref={dialogRef}>
        <button className="modal-close" onClick={onClose} aria-label="Close how it works">
          <CloseIcon />
        </button>

        <div className="how-visual" aria-hidden="true">
          <div className="mock-side left" />
          <div className="mock-side right" />
          <div className="mock-card">
            <div className="mock-top">
              <span className="lime">{s.signal}</span>
              <span className="muted">{s.metric}</span>
            </div>
            <div className="mock-body">
              <div className="mock-title">Will BOT be above $12.50 at 20:00 UTC?</div>
              <div className="mock-tokens">
                <span>BOT</span><span>YES</span><span>NO</span><span>+12 predictors</span>
              </div>
            </div>
            <div className="mock-facts">
              <span>48 BOT</span><span>1 hour</span><span>BOT Chain</span>
            </div>
            <div className="mock-signal">
              <span className="lime">{step === 3 ? "RESOLVED YES" : "YES LEADS"}</span>
              <span className="muted">1.4x</span>
            </div>
          </div>
        </div>

        <div className="how-body">
          <div className="how-counter mono-num">{String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</div>
          <div className="how-dashes" aria-hidden="true">
            {STEPS.map((_, i) => <span key={i} className={i === step ? "on" : ""} />)}
          </div>
          <div className="label">{s.kicker}</div>
          <h2 id="how-title">{s.title}</h2>
          <p>{s.body}</p>
          <div className="how-nav">
            <button className="ghost-button" onClick={() => setStep((n) => n - 1)} disabled={step === 0}>Back</button>
            <button className="create-button" onClick={() => (last ? onClose() : setStep((n) => n + 1))}>{last ? "Start" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
