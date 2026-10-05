/** Inline icons: 1.8px strokes, currentColor (frontend.md §1). */
import type { SVGProps } from "react";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "square" as const,
  strokeLinejoin: "miter" as const,
  "aria-hidden": true,
};

type P = SVGProps<SVGSVGElement>;

/** STAKE mark: a stake planted in the ground, diamond head. */
export function StakeMark(props: P) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="M16 3 L22.5 9.5 L16 16 L9.5 9.5 Z" fill="currentColor" />
      <path d="M16 16 V27" stroke="currentColor" strokeWidth="2.4" />
      <path d="M6 28 H26" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export const SearchIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
);
export const PoolIcon = (p: P) => (
  <svg {...base} {...p}><ellipse cx="12" cy="6.5" rx="7" ry="2.8" /><path d="M5 6.5v5.5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6.5" /><path d="M5 12v5.5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V12" /></svg>
);
export const ClockIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const UsersIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17 14.6c2 .5 3.2 2 3.6 4.4" /></svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const ArrowLeftIcon = (p: P) => (
  <svg {...base} {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const WalletIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 7h14v12H4z" /><path d="M4 7l11-3v3" /><path d="M14 13h4" /></svg>
);
