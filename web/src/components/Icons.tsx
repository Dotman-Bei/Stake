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

/*
 * STAKE identity (see /brand): an S split by a diagonal slash into two point-symmetric
 * halves. Upper half = YES (accent), lower half = NO (currentColor).
 */
const MARK_YES = "M0 0H24V5H5V9.5H12.5L9.5 14.5H0Z";
const MARK_NO = "M24 24H0V19H19V14.5H11.5L14.5 9.5H24Z";
const WORD_LETTERS =
  "M29 0H49V5H41.5V24H36.5V5H29ZM54 0H74V24H69V14.5H59V24H54ZM59 5V9.5H69V5ZM79 0H84V9.5L93 0H99.5L89.5 12L99.5 24H93L84 14.5V24H79ZM104.5 0H124.5V5H109.5V9.5H121.5V14.5H109.5V19H124.5V24H104.5Z";

/** The split-S mark. Pass `mono` to draw both halves in currentColor. */
export function StakeMark({ mono = false, ...props }: P & { mono?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d={MARK_YES} fill={mono ? "currentColor" : "var(--accent)"} />
      <path d={MARK_NO} fill="currentColor" />
    </svg>
  );
}

/** The STAKE wordmark: split S + letters drawn on the same grid. */
export function StakeWordmark(props: P) {
  return (
    <svg viewBox="0 0 124.5 24" role="img" aria-label="STAKE" {...props}>
      <path d={MARK_YES} fill="var(--accent)" />
      <path d={MARK_NO + WORD_LETTERS} fill="currentColor" fillRule="evenodd" />
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
