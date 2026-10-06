// STAKE brand assets: generated from one geometric source so every file stays in sync.
// Grid: 24 units cap height, 5-unit strokes, 4.5-unit counters, square corners.
import fs from "node:fs";

// The mark: an S split by a diagonal slash into two point-symmetric halves (YES / NO).
const YES = "M0 0H24V5H5V9.5H12.5L9.5 14.5H0Z";            // upper half
const NO = "M24 24H0V19H19V14.5H11.5L14.5 9.5H24Z";        // lower half (180° rotation of YES)

// Wordmark letters on the same grid (20 wide), offset by x.
const T = (x) => `M${x} 0H${x + 20}V5H${x + 12.5}V24H${x + 7.5}V5H${x}Z`;
const A = (x) => `M${x} 0H${x + 20}V24H${x + 15}V14.5H${x + 5}V24H${x}ZM${x + 5} 5V9.5H${x + 15}V5Z`;
const K = (x) => `M${x} 0H${x + 5}V9.5L${x + 14} 0H${x + 20.5}L${x + 10.5} 12L${x + 20.5} 24H${x + 14}L${x + 5} 14.5V24H${x}Z`;
const E = (x) => `M${x} 0H${x + 20}V5H${x + 5}V9.5H${x + 17}V14.5H${x + 5}V19H${x + 20}V24H${x}Z`;
const LETTERS = [T(29), A(54), K(79), E(104.5)].join("");
const WORD_W = 124.5;

const C = {
  ink: "#0a0907",      // STAKE canvas
  paper: "#f0f0f0",    // --g50
  accent: "#5cd0ff",   // --accent (on dark)
  accentDeep: "#0077a8", // accent for light grounds (AA on white: 5:1)
};

const svg = (w, h, body, title, pad = 0) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
const p = (d, fill, rule = "") => `<path d="${d}" fill="${fill}"${rule ? ` fill-rule="${rule}"` : ""}/>`;

const files = {
  // mark
  "stake-mark.svg": svg(24, 24, p(YES, C.accent) + p(NO, C.paper), "STAKE"),
  "stake-mark-light.svg": svg(24, 24, p(YES, C.accentDeep) + p(NO, C.ink), "STAKE"),
  "stake-mark-mono-black.svg": svg(24, 24, p(YES, C.ink) + p(NO, C.ink), "STAKE"),
  "stake-mark-mono-white.svg": svg(24, 24, p(YES, "#ffffff") + p(NO, "#ffffff"), "STAKE"),
  // wordmark (the split S is the first letter)
  "stake-wordmark.svg": svg(WORD_W, 24, p(YES, C.accent) + p(NO + LETTERS, C.paper, "evenodd"), "STAKE"),
  "stake-wordmark-light.svg": svg(WORD_W, 24, p(YES, C.accentDeep) + p(NO + LETTERS, C.ink, "evenodd"), "STAKE"),
  "stake-wordmark-mono-black.svg": svg(WORD_W, 24, p(YES + NO + LETTERS, C.ink, "evenodd"), "STAKE"),
  "stake-wordmark-mono-white.svg": svg(WORD_W, 24, p(YES + NO + LETTERS, "#ffffff", "evenodd"), "STAKE"),
  // app icon / favicon: mark on the canvas square, 4-unit clear space
  "stake-app-icon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="STAKE"><title>STAKE</title><rect width="32" height="32" fill="${C.ink}"/><g transform="translate(4 4)">${p(YES, C.accent)}${p(NO, C.paper)}</g></svg>\n`,
};

for (const [name, body] of Object.entries(files)) fs.writeFileSync(new URL(`./${name}`, import.meta.url), body);
fs.writeFileSync(new URL("./paths.json", import.meta.url), JSON.stringify({ YES, NO, LETTERS, WORD_W }, null, 2) + "\n");
console.log(Object.keys(files).join("\n"));
