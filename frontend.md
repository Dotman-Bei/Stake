# Frontend Style & Structure Guide — "Trench" system

Extracted from [`ELLA0VICTOR/trench-markets`](https://github.com/ELLA0VICTOR/trench-markets). An agent-to-agent prediction-market intelligence desk: browse markets, buy an analyst report over x402, publish a proof on Arc.

**The one-line description:** a dark trading terminal set in monospace. A warm near-black canvas inside a 1728px column framed by hairlines, IBM Plex Mono for almost everything, one acid-lime accent (`#d4ff3e`), square corners, 1px rules instead of cards, a sticky glass top bar and tab strip, and a market grid where cells share borders like a spreadsheet. Instrument Serif appears in only four places, as a large display contrast to the mono.

**Written for building agents.** §6 is a section-by-section blueprint of the home screen, and §7 is a replace map of every Trench-specific string, URL, data source and claim.

---

## 0. Read this first

1. **There is no marketing landing page.** The home screen *is* the product: top bar, filter tabs, market grid, footer. The explanation lives in a four-step "How it works?" modal opened from the top bar. If you need a separate marketing page, §6.7 describes an orphaned `Intro` component you can start from.
2. **No licence file.** Without one, default copyright applies. This spec documents the design language; ask the author before lifting source files wholesale.
3. **Tailwind is installed but unused.** There's a `trench` colour block in `tailwind.config.js`, but not one of the app's 191 `className`s uses a Tailwind utility. Tailwind supplies only the preflight reset. The whole design is ~2,700 lines of hand-written CSS in `src/index.css`.
4. **Six components are dead code.** `Intro`, `AgentDesk`, `AgentProtocol`, `MarketRail`, `AnalysisPanel` and `SettlementPanel` are never mounted. Their CSS (some of it) is still in the stylesheet. Don't mistake them for the live layout.

---

## 1. Stack and file map

| Concern | Choice |
|---|---|
| Build | Vite 8 + React 19 + TypeScript; no router, no state library |
| Styling | One hand-written stylesheet, `src/index.css`, with CSS custom properties and BEM-ish class names |
| Fonts | Google Fonts `@import` at the top of the CSS: **IBM Plex Mono** (400/500/600, italic 400) and **Instrument Serif** (regular and italic) |
| Icons | Inline SVG, 1.8px strokes, `currentColor`; one SVG brand mark |
| Motion | None. No keyframes; 160ms colour/border/opacity transitions only |
| Routing | View state in `App.tsx` (`detailMarketId`, `reportMarketId`), mirrored to the URL with `history.replaceState` |
| Backend | Express server in `/server`, proxied at `/api` in dev (`vite.config.ts`) |

```
index.html                    title "Trench", meta description, favicon
public/favicon.svg            the mark in lime on the canvas colour
src/
  main.tsx                    mounts <App/> and imports index.css
  index.css                   THE DESIGN SYSTEM (tokens, every component, breakpoints)
  App.tsx                     all state; chooses Board, Detail or Report view
  components/
    Topbar.tsx                brand, search, How it works?, balance chip, wallet button + menu
    MarketTabs.tsx            sticky filter strip
    MarketBoard.tsx           board header + market grid + empty state
    MarketCard.tsx            the grid cell
    CreateMarketPanel.tsx     collapsible "create a market" form above the grid
    HowItWorksModal.tsx       4-step onboarding modal
    MarketDetail.tsx          detail view: main column + sticky action rail
    ReportPage.tsx            unlocked report view
    PublishSuccessModal.tsx   proof-published confirmation
    Footer.tsx                four-column teal footer
    TrenchMark.tsx            brand mark SVG
    (dead) Intro, AgentDesk, AgentProtocol, MarketRail, AnalysisPanel, SettlementPanel
  data/markets.ts             tab names + 4 seed markets
  services/gamma.ts           live feed (Polymarket Gamma API), tone hashing
  lib/format.ts, marketMath.ts, explorer.ts, api.ts
```

---

## 2. Colour tokens

```css
:root {
  /* neutrals */
  --black: #000;  --white: #fff;
  --g50: #f0f0f0; --g100: #d8d8d8; --g200: #b0b0b0; --g400: #787878;
  --g600: #484848; --g700: #303030; --g800: #1e1e1e; --g900: #111;

  /* grounds — warm near-blacks */
  --bg:        #0a0907;
  --surface:   #0f0e0b;
  --surface-2: #15130f;

  /* lines */
  --rule:        rgba(240, 240, 240, 0.13);
  --rule-strong: rgba(240, 240, 240, 0.22);

  /* the accent */
  --accent:        #d4ff3e;                  /* acid lime */
  --accent-dim:    rgba(212, 255, 62, 0.08);  /* tinted fill */
  --accent-border: rgba(212, 255, 62, 0.28);  /* tinted edge */

  /* status + one deep colour */
  --danger:  #f27575;
  --warning: #f0c15f;
  --teal:    #003f3d;                         /* footer ground */
}
```

### How the palette is spent

- **Warm black, not neutral black.** The three grounds carry a slight brown cast (`#0a0907`, `#0f0e0b`, `#15130f`), so the page reads as an old terminal rather than a code editor.
- **One accent, three strengths.** Lime appears solid (primary buttons, selection), as text (balance chip, signals, status tags, links), or as an 8% fill with a 28% edge (active tab, wallet button, feed chip, active card outline). That "dim fill + tinted border + lime text" triple is the system's standard way to mark something as active or live.
- **Text runs from bright to dark grey:** `--white` for titles and values, `--g100` for body, `--g200` for modal body, `--g400` for secondary, `--g600` for uppercase labels, `--g700` for placeholders.
- **Two deep teals break the black.** `--teal` `#003f3d` fills the footer; `#042f2e` fills the detail page's action card; `#0d1a15` backs the how-it-works visual. They're the only non-neutral grounds.
- **Card tones.** Each market card body gets one of six barely-tinted near-blacks, picked by hashing the market title, so the grid has variety without colour:

  ```css
  .tone-mint   { background: #0d1a15; }   .tone-rose   { background: #1b1112; }
  .tone-ivory  { background: #1b1810; }   .tone-blue   { background: #0f1620; }
  .tone-violet { background: #171222; }   .tone-amber  { background: #1d160d; }
  ```
- **Saturated colour only in avatars.** The participant stack uses five fixed fills (`#384bff`, `#006b52`, `#6f63ff`, `#7a3d18`, `#111`).
- `::selection` is black on lime.

### Measured contrast

| Pair | Ratio |
|---|---|
| `--g100` body on `--bg` | 13.96 |
| lime on `--bg` | 17.22 |
| black on lime (primary button) | 18.17 |
| lime on `--accent-dim` (active tab, wallet) | 14.87 |
| `--g50` on footer teal | 10.36 |
| white on any card tone | 17.7–18.5 |
| `--g400` secondary on `--bg` | 4.51 |
| `--g400` on `--surface` | **4.37** |
| `--g400` on a card tone | **4.01–4.19** |
| `--g400` on the action card `#042f2e` | **3.28** |
| `--g600` uppercase labels on `--bg` | **2.18** |
| `--g700` textarea placeholder on `--bg` | **1.51** |

The bright end is excellent. The grey end is where it fails, and §9 covers the fixes.

---

## 3. Typography

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=Instrument+Serif:ital@0;1&display=swap');

:root { font: 15px/1.55 var(--mono); letter-spacing: 0; }
```

### Rules

- **Mono is the default for everything:** body, buttons, inputs, card titles, the detail page `h1`, stats, labels.
- **Serif is a rare display contrast.** Instrument Serif at weight 400 appears on exactly four elements: the board `h1` "Markets" (44px, 34px on phones), the create-panel heading (32px), the empty-state heading (42px), and the unused desk card. It's never italic, though the italic is loaded.
- **Weight carries hierarchy inside the mono:** 600 for titles, brand and primary buttons; 500 for labels; 400 for body.
- **Uppercase micro-labels** at 11px, weight 500, in `--g600`, with no extra letter-spacing. They label every stat, field and column.

### Scale in use

| Role | Spec |
|---|---|
| Board h1 | Instrument Serif 44px / 0.95 (34px ≤760px) |
| Empty-state h2 | Instrument Serif 42px |
| Create-panel h2 | Instrument Serif 32px / 1 |
| Detail h1 | Plex Mono 600, 34px / 1.28, `overflow-wrap: anywhere` |
| How-it-works h2 | Plex Mono 26px / 1.1 |
| Brand wordmark | Plex Mono 600, 24px |
| Body | Plex Mono 15px / 1.55 |
| Card title | Plex Mono 600, 14px / 1.18 |
| Card footer, signal | 13px |
| Labels | 11px uppercase, 500 |
| Avatar initials | 10px, 600 |

---

## 4. Surface grammar

- **Square everything.** Buttons and inputs set `border-radius: 0`. The only round things are the participant avatars.
- **Rules, not cards.** Structure is drawn with 1px `--rule` lines: the app shell's left and right edges, under the top bar, under the tabs, between grid cells, between footer columns. Panels are mostly transparent; hover and active states fill with `--surface`.
- **Spreadsheet grid.** Market cards have no border of their own. Each draws only its right and bottom edge, and the last cell in each row drops its right edge (`:nth-child(3n)`, re-mapped to `2n` at two columns). Cells share lines like a table.
- **Active card:** `background: var(--surface); box-shadow: inset 0 0 0 1px var(--accent-border)`. An inset lime outline instead of a lift.
- **Buttons, by role:**
  | Class | Look |
  |---|---|
  | `.create-button`, primary in forms | solid lime, black text, 600 |
  | `.wallet-button` | lime text on `--accent-dim`, lime edge |
  | `.link-button` | transparent, `--g100` text, white on hover |
  | `.market-tabs button` | transparent, `--g400`; active uses the dim-lime triple |
  | `.back-button` | lime text, no fill, right and bottom rules only |

  All are at least 44px tall. Hover on solid buttons is `opacity: .84`; on text buttons it's a colour change.
- **Chips.** `.balance-chip` ("Arc USDC") is lime text on surface; `.feed-chip` is the dim-lime triple at 12px.
- **Shadows** appear only on floating layers: the wallet menu (`0 18px 48px rgba(0,0,0,.42)`) and modals (`0 24px 80px rgba(0,0,0,.5)`).
- **Glass** on the two sticky bars: `rgba(10,9,7,.94)` with `backdrop-filter: blur(16px)`. Modal scrims: `rgba(0,0,0,.72)` with `blur(9px)`.

---

## 5. Layout

```css
.app-shell { width: min(100%, 1728px); margin: 0 auto; border-inline: 1px solid var(--rule); }
```

A single framed column up to 1728px; on wide screens the hairlines on each side frame the app against the page. Below 760px the side borders drop.

### Sticky stack

```
.topbar        sticky, top: 0,     min-height 88px, z 30
.market-tabs   sticky, top: 88px,  min-height 62px, z 20   (top: 112px ≤760px)
```

The tabs' sticky offset is hard-coded to the top bar's height. Between 760px and 980px the top bar wraps its actions onto a second row, so check that the two bars don't overlap at those widths. If you change the top bar's height, change the tabs' `top` with it, or set both from one variable.

### Top bar grid

`grid-template-columns: max-content minmax(260px, 1fr) max-content`: brand, a stretching search box, actions. At ≤980px actions move to their own row; at ≤760px the wordmark hides, search drops to row 2 full width, and labels swap to short forms ("How?", "Connect", "Create").

### Breakpoints

| Width | Change |
|---|---|
| ≤1280 | top bar tightens |
| ≤1180 | detail view: action rail stacks under the main column |
| ≤1040 | market grid 3 → 2 columns; footer 4 → 2 columns |
| ≤980 | top bar actions wrap to a second row |
| ≤760 | phone layout: grid 1 column, search on its own row, short labels, shell borders off |
| ≤380 | final tightening of top-bar chips |

---

## 6. Home screen blueprint

```
Topbar  (sticky)       brand · search · How it works? · balance chip · wallet
MarketTabs (sticky)    New · Trending · Ending Soon · Macro · Crypto · Arc · Custom
main#top
  CreateMarketPanel    collapsible form (hidden until "Create market")
  MarketBoard
    board-header       eyebrow + serif "Markets" · feed chip · Create market
    market-grid        3 / 2 / 1 columns of MarketCards
    (empty-state)      serif "No markets found"
Footer                 teal, 4 columns
—
HowItWorksModal        4-step explainer, opened from the top bar
```

### 6.1 Top bar

- **Brand:** the 29px lime mark (an eight-point star with a centre dot) plus "Trench" in 24px mono 600. Links to `#top`.
- **Search:** a 54px bordered box on `--surface` with a 20px magnifier and placeholder "Search markets...". Filters the grid as you type.
- **Actions:** "How it works?" (text button, opens the modal), a static **"Arc USDC"** balance chip, and the wallet button ("Connect wallet" → shortened address once connected). The wallet button opens a menu listing injected browser wallets (EIP-6963 style: icon, name, rdns), or, once connected, "Copy address / Change wallet / Disconnect".

**Replace:** mark, name, search placeholder, the chip label (it's a fixed string, not a balance; either wire a real balance or relabel it as the network), the wallet flow if your product has no wallet.

### 6.2 Filter tabs

A horizontally scrolling strip of transparent text buttons; the active one gets the dim-lime triple. Tabs come from `marketTabs` in `data/markets.ts`.

**Replace:** the tab list with your categories. Keep 5–8; the strip scrolls but long strips hide the end.

### 6.3 Create panel

Hidden until the board's "Create market" button toggles it. A two-column band (`290px 1fr`) on `--surface`: a label "Custom market" and serif heading "Create a market for the agent to price" on the left; on the right a textarea, an image-upload row ("Market image" … "Upload optional" in lime), an optional preview, and Cancel / "Create and analyze" (lime).

**Replace:** heading, placeholder question, the submit label, and what the form creates. The pattern (a collapsible creation band above the grid rather than a modal) works for any "add an item" flow.

### 6.4 Board header

An eyebrow "Markets" over a serif `h1` "Markets" (the eyebrow duplicates the heading; give it a different word), then on the right a feed chip and the solid lime "Create market" button. The feed chip reads "Syncing market feed" while loading, then "trench-markets feed" when live, or "Seed feed active" on fallback.

**Replace:** eyebrow and heading, the three feed states, the create label.

### 6.5 Market card

A tall (`min-height: 560px`) cell, entirely clickable, in four rows:

1. **Tags:** a "trench-markets" source tag on `--surface-2` and a lime status tag ("Live") on `--accent-dim`.
2. **Body** (`min-height: 384px`) on the card's tone colour: a square image (or, without one, a **fallback visual** of four lime-outlined bars of different heights with the market's two-letter code), the title in 14px mono 600, then a row of overlapping 34px round avatars (the market image first, then up to five initials in fixed colours) with "+N more" on the right.
3. **Footer:** three icon + value pairs: 24h volume, time left, venue.
4. **Signal:** a ruled bottom row with the agent's call on the left in lime ("BUY YES", "BUY NO" or "PASS") and the market price on the right in grey ("41% market").

The fallback bar visual is worth keeping: it gives image-less items a consistent, on-brand thumbnail.

**Replace:** the source tag, status values, the meaning of the three footer stats, and the signal row's left/right values. For a non-market product the shape still holds: tags, visual, title, people, three facts, one verdict.

### 6.6 Empty state

Centred, 420px tall, serif 42px "No markets found" and a grey line suggesting a different search or a custom market.

### 6.7 The orphaned intro (optional marketing hero)

`components/Intro.tsx` is a hero that was cut from the live layout: a kicker "00 / agent market terminal", an `h1` "Trench", one sentence, and a four-cell **status strip** (Feed, Runs, Report price, Status). Its CSS classes (`.intro-grid`, `.section-kicker`, `.status-strip`) don't exist in the stylesheet, so mounting it gives unstyled output. If you want a landing hero in this style, restyle it from the system's parts: a serif `h1` at 80–120px, a mono kicker, and the status strip drawn like `.detail-stats` (four ruled cells, 11px label over a white value).

### 6.8 How it works modal

A 690px dialog with a lime edge, in two halves:

- **Visual (306px, teal-black `#0d1a15`):** a mock market card flanked by two faded side cards. The card's topline and signal change with each step ("87% market / Live feed" → "$0.04-$2 / Edge priced" → "Arc USDC / Buyer paid" → "Proof ready / On-chain proof").
- **Body:** "01"–"04" counter, four 34px×2px progress dashes (active one lime), a kicker, a 26px title, a paragraph, and Back / Next (Next becomes "Start" on the last step). Escape and backdrop click close it.

Steps: **Pick a market → Request a priced report → Unlock with buyer USDC → Publish the proof.**

**Replace:** the four `steps` (kicker, title, body, signal, metric) and the mock card's title, tokens ("AI", "402", "Arc", "USDC", "+12 signals") and metrics ("$38K", "3 days", "Global").

### 6.9 Footer

`grid-template-columns: 2fr 1fr 1fr 1fr` on the teal ground, each column ruled on its right, `min-height: 340px`. Brand block with a one-paragraph description, then Markets (New, Trending, Ending Soon, Custom), Resources (Arc docs, Circle docs, Agora docs), Community (GitHub, Agora). Links in `--g50`, lime on hover.

Note: the four Markets links all point to `#top` and don't switch the tab they name.

**Replace:** description, columns, links. Wire the category links to the tab state or remove them.

### 6.10 Detail and report views

Not part of the home screen, but they follow the same grammar:

- **Detail:** a two-column layout (`1fr` + a `clamp(340px, 25vw, 430px)` action rail). Main column: a ruled "Back to markets" button, a hero (86px visual + tags + mono `h1`), a four-cell ruled stats row, and ruled sections. The rail holds a teal action card with a three-tab stepper (Quote · Payment · Proof), the signal grid, pricing note and actions. The rail stacks below the main column at ≤1180px.
- **Report:** back button, header, then ruled panels: a metric grid, two-column thesis/details, evidence, catalysts and risks lists, sources, and the proof panel with an explorer link.

---

## 7. Replace map

| What | Where | Trench value | Replace with |
|---|---|---|---|
| Name | `index.html` `<title>`, `Topbar`, `Footer`, modal card | "Trench" | your name |
| Meta description | `index.html` | agent-to-agent prediction market intelligence… | yours |
| Mark | `TrenchMark.tsx`, `public/favicon.svg` | eight-point star with centre dot, lime on `#0a0907` | your mark, `currentColor` |
| Accent | `--accent`, `--accent-dim`, `--accent-border` | `#d4ff3e` | your accent (recompute the dim and border alphas) |
| Footer ground | `--teal`; also `#042f2e`, `#0d1a15` inline in CSS | deep teals | your second colour |
| Search placeholder | `Topbar.tsx` | "Search markets..." | your noun |
| Balance chip | `Topbar.tsx` | static "Arc USDC" | a real balance, network name, or remove |
| Wallet flow | `Topbar.tsx`, `services/x402BuyerWallet.ts` | browser wallets, Arc testnet | your auth, or remove |
| Tabs | `data/markets.ts` `marketTabs` | New … Custom | your categories |
| Seed data | `data/markets.ts` `seedMarkets` | 4 markets (Fed, Arc volume, …) | your seed items |
| Live feed | `services/gamma.ts` | Polymarket Gamma API, top 18 by 24h volume | your source |
| Feed chip | `MarketBoard.tsx` | "Syncing market feed" / "trench-markets feed" / "Seed feed active" | your states |
| Card source tag | `MarketCard.tsx` | literal "trench-markets" on every card | your source label |
| Card stats | `MarketCard.tsx` | volume, time left, venue | your three facts |
| Signal labels | `lib/marketMath.ts` `signalFor` | "BUY YES" / "BUY NO" / "PASS" at ±5.5 pts | your verdicts |
| Create panel | `CreateMarketPanel.tsx` | "Create a market for the agent to price" + placeholder | your creation copy |
| How-it-works steps | `HowItWorksModal.tsx` | 4 steps: market → report → x402 → Arc proof | your flow |
| Modal mock card | `HowItWorksModal.tsx` | question, tokens, $38K / 3 days / Global | your example |
| Footer copy + links | `Footer.tsx` | Arc, Circle, Agora docs; GitHub repo | yours |
| Explorer | `lib/explorer.ts` / `VITE_ARC_EXPLORER_TX_URL` | testnet.arcscan.app | your explorer |
| API base | `lib/api.ts` / `VITE_API_BASE_URL`; `vite.config.ts` proxy | `/api` → `127.0.0.1:8787` | your API |

---

## 8. Motion

Deliberately none. No keyframes, no entrance animation, no scroll effects. Interactive elements transition `color`, `border-color`, `background` and `opacity` over 160ms. State changes (tab switch, card select, step change) are instant. That stillness is part of the terminal character; if you add motion, keep it to state transitions.

---

## 9. Accessibility and known issues

| Issue | Detail | Fix |
|---|---|---|
| **Uppercase labels fail contrast** | `--g600` `#484848` on the canvas: **2.18:1**, and it labels every stat, field and column | raise `--g600` to about `#8a8a8a` (≥4.5:1 on `--surface`) |
| Secondary text on tinted grounds | `--g400` drops to 4.01–4.19 on card tones and **3.28** on the action card | lift `--g400` a step, or use `--g200` on tinted grounds |
| Invisible placeholder | textarea placeholder `--g700`: **1.51:1** | use `--g400` |
| **Search input has no focus ring** | `.search-box input { outline: 0 }` comes after the global `input:focus-visible` rule at equal specificity, so it wins | add `.search-box:focus-within { border-color: var(--accent-border); }` |
| Cards are buttons with headings inside | `MarketCard` is a `<button>` wrapping an `h3`, `div`s and the whole card text, which isn't valid inside a button and makes a very long accessible name | make the card an `<article>` with one button or link on the title |
| Modal focus | `HowItWorksModal` doesn't move focus into the dialog or trap it; the close button's label is the letter "X" (it does have `aria-label`) | focus the dialog on open, trap Tab, return focus on close; use an icon |
| Duplicate heading | board eyebrow and `h1` both say "Markets" | change the eyebrow |
| Footer links mislead | Markets links all go to `#top` without changing the tab | wire them or remove |
| Static balance chip | "Arc USDC" looks like a balance but is a constant | label it as the network or show a real balance |
| Sticky offset coupling | tabs `top: 88px` / `112px` hard-coded to the top bar height | drive both from one variable |
| Unused Tailwind | installed and configured, zero utilities used | remove it, or keep it only for the reset |
| Dead code | six unmounted components; `Intro` has no CSS | delete, or restyle before mounting |
| Duplicate dependency key | `solc` appears twice in `devDependencies` (`^0.8.35`, `^0.8.31`) | keep one |
| Unused assets | `src/assets/hero.png`, `react.svg`, `vite.svg` from the Vite template | delete |

Good things to keep: a global `:focus-visible` outline in lime (1px, 3px offset) on buttons, links, inputs and textareas; 44px minimum hit targets; short labels on phones rather than truncation; `aria-label`s on the brand link, the tab `nav`, the board and the stats rows; `role="dialog"` with `aria-modal` and `aria-labelledby` on the modal; Escape to close.

---

## 10. Copy voice

- **Terminal-plain labels:** "Markets", "Custom market", "Feed", "Runs", "Status", "Unlock agent signal", "Report ready".
- **Verdicts in caps:** "BUY YES", "BUY NO", "PASS".
- **Prices as facts:** "41% market", "$0.04-$2", "Arc USDC".
- **Steps as verb phrases:** "Pick a market", "Request a priced report", "Unlock with buyer USDC", "Publish the proof".
- **Numbered kickers:** "00 / agent market terminal", "01"–"04" in the modal.
- **One sentence of description, then the tool.** No hero copy on the home screen at all.

---

## 11. Build checklist for an agent

1. Load a mono and a serif (Google Fonts or self-hosted). Set the mono as the root font at 15px/1.55.
2. Declare the tokens in §2 with your accent; derive `--accent-dim` (8%) and `--accent-border` (28%) from it. Raise `--g600` and `--g700` to pass contrast before you start.
3. Build the shell: `min(100%, 1728px)` with hairline side borders.
4. Sticky top bar (brand · search · actions) and sticky tab strip under it, both on 94% canvas with a 16px blur, offsets from one shared variable.
5. Square everything; 44px minimum controls; one solid-accent primary, the dim-accent triple for active/live, text buttons for the rest.
6. Grid of cells that share 1px rules; active cell gets an inset accent outline.
7. Card anatomy from §6.5, with the tone hashing and the fallback bar visual for image-less items.
8. Serif only for the board heading, create heading and empty state.
9. A stepper modal for "how it works" with a live mock of your own card.
10. Teal (or your second colour) footer in ruled columns.
11. No animation beyond 160ms state transitions.
12. Fix the focus and markup issues in §9 as you build, not after.

---

## 12. What to keep, what to change

| Keep | Change |
|---|---|
| Mono as the body face, serif as a rare display contrast | The two faces |
| One accent used at three strengths (solid, text, dim fill + tinted edge) | The accent colour |
| Warm near-black grounds | The warmth, if your product is cooler |
| Cells sharing 1px rules like a spreadsheet | Column counts |
| Hashed near-black tones per card | The six tones |
| Fallback bar visual for items without images | Bar count and heights |
| Product-first home: the tool is the landing | Only if you need SEO or a pitch; then add a hero (§6.7) |
| Stepper modal as the explainer | The steps |
| No motion | — |
| The grey ramp | **Lighten the bottom of it** (§9) |

**The idea to think hardest about:** this home screen sells by being the product. There's no headline, no benefits, no testimonials; a visitor lands straight in a live grid with a verdict on every card. That works when the grid itself is persuasive (real data, a clear verdict, and an obvious next click) and when your visitors already know what the category is. If your audience needs to be told what the product does before they'll touch it, keep this system for the app and put a short hero in front of it, built from the same parts.
