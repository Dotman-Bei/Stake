# STAKE brand mark

## Concept: the split S

STAKE is a binary market: every position is YES or NO. The mark is a single **S**
cut by a diagonal slash into two halves. The halves are exact 180° rotations of each
other: two equal sides of one bet, with the stake driven through the middle.

- **Upper half = YES**, in the accent colour.
- **Lower half = NO**, in the neutral (paper or ink).

The wordmark is drawn on the same grid as the mark, not typeset from a font. The split S
is its first letter, so mark and wordmark are one system.

## Construction

| | |
|---|---|
| Grid | 24 units cap height |
| Stroke | 5 units (bars, legs, stems) |
| Counters | 4.5 units |
| Slash | 3-unit horizontal run, 2-unit gap |
| Corners | square, no rounding |
| Letter width | S 24, T/A/E 20, K 20.5; 5-unit tracking |

Everything is generated from one source, [`build.mjs`](build.mjs), with the paths also in
[`paths.json`](paths.json). Edit the geometry there and run `node brand/build.mjs`.

## Files

| File | Use |
|---|---|
| `stake-mark.svg` | Mark, colour, on dark grounds |
| `stake-mark-light.svg` | Mark, colour, on light grounds |
| `stake-mark-mono-black.svg` / `-mono-white.svg` | One-colour mark |
| `stake-wordmark.svg` | Wordmark, colour, on dark grounds |
| `stake-wordmark-light.svg` | Wordmark, colour, on light grounds |
| `stake-wordmark-mono-black.svg` / `-mono-white.svg` | One-colour wordmark |
| `stake-app-icon.svg` | Favicon / app icon: mark on the canvas square |

## Colour

| Token | Hex | Role |
|---|---|---|
| Accent | `#5cd0ff` | YES half on dark grounds |
| Accent deep | `#0077a8` | YES half on light grounds (5:1 on white) |
| Paper | `#f0f0f0` | NO half and letters on dark |
| Ink | `#0a0907` | NO half and letters on light; icon ground |

Flat colour only: no gradients, shadows or outlines.

## Usage

- **Clear space:** at least 5 units (one stroke width) on every side.
- **Minimum size:** mark 16 px; wordmark 14 px tall.
- **Never** rotate, skew, recolour the halves to anything but the pairs above, fill the slash gap, or set "STAKE" in a font next to the mark. Use the wordmark file.
