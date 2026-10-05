"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Topbar } from "./Topbar";
import { HowItWorksModal } from "./HowItWorksModal";

/** Client shell: sticky top bar + how-it-works modal around each route. */
export function Chrome({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const [howOpen, setHowOpen] = useState(false);
  const close = useCallback(() => setHowOpen(false), []);
  return (
    <div className="app-shell">
      <Topbar onHowItWorks={() => setHowOpen(true)} />
      <main id="top" className="app-main">{children}</main>
      {footer}
      <HowItWorksModal open={howOpen} onClose={close} />
    </div>
  );
}
