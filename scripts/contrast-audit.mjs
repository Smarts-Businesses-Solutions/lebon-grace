#!/usr/bin/env node
/**
 * WCAG contrast audit for the colour pairs this project actually renders.
 *
 * ACTION_PLAN.md A-17 requires "contrast audit passes". This is that check, kept
 * runnable so it stays true:
 *
 *     npm run audit:contrast
 *
 * ── What this is, and what it is not ──────────────────────────────────────
 *
 * It audits the pairs DECLARED below, not the live DOM. That is a real
 * limitation and worth stating: a new component with a new pairing is invisible
 * to this script until someone adds it here.
 *
 * The live-DOM alternative was attempted and abandoned. The admin page would not
 * hydrate inside the in-app browser (no React fiber attached, in dev *or* a
 * production build), so `getComputedStyle` over rendered text was not available.
 * A static list that is correct beats a browser run that silently measures an
 * unhydrated page — this project has already been bitten once by a contrast
 * script that reported ratios in the billions because it parsed digits out of
 * `oklab()` strings and never composited anything.
 *
 * The arithmetic here is the WCAG 2.1 definition, not an approximation:
 * sRGB → linear → relative luminance → (L1+0.05)/(L2+0.05).
 *
 * Thresholds: 4.5:1 normal text, 3:1 large text (>=24px, or >=18.66px bold).
 * Anything marked `large` must genuinely be large in the markup — that flag is
 * an assertion about the CSS, so if a font size shrinks, update it here too.
 */

const TOKENS = {
  // src/app/globals.css @theme
  ink: "#23201c", "ink-soft": "#3a352e", "ink-muted": "#7d766c",
  bone: "#fdfbf7", paper: "#f7f3ec", "paper-deep": "#efe8dc",
  sand: "#c9a96e", "sand-dark": "#a8874d", sage: "#5f7355", rule: "#e3dcd1",
};

// Tailwind v4 defaults, for the semantic status colours the admin uses.
const TW = {
  "red-400": "#ff6467", "red-700": "#c10007", "red-800": "#9f0712",
  "yellow-700": "#a65f00", "yellow-800": "#894b00",
  "green-700": "#008236", "blue-700": "#1447e6", "indigo-700": "#432dd7",
  "purple-700": "#8200db", "emerald-700": "#007a55",
  "red-50": "#fef2f2", "yellow-50": "#fefce8", "yellow-100": "#fef9c3",
  "green-50": "#f0fdf4", "blue-50": "#eff6ff", "blue-100": "#dbeafe",
  "indigo-50": "#eef2ff", "purple-50": "#faf5ff", "emerald-50": "#ecfdf5",
};

const C = { ...TOKENS, ...TW };

/** [label, foreground, background, isLargeText] */
const PAIRS = [
  ["body text on card", "ink-soft", "bone"],
  ["body text on page", "ink-soft", "paper"],
  ["headings on card", "ink", "bone"],
  ["KPI value (20px bold)", "sand-dark", "bone", true],
  ["header links (dark bar)", "sand", "ink"],
  ["header logo/title", "bone", "ink"],
  ["Admin badge (dark bar)", "sand-dark", "ink"],
  ["engraving chip", "sand", "ink"],
  ["active tab / dark buttons", "bone", "ink"],
  ["gold hover button label", "ink", "sand-dark"],
  ["queue: overdue warning", "red-700", "paper"],
  ["queue: in-progress pill", "blue-700", "blue-100"],
  ["queue: not-started pill", "yellow-800", "yellow-100"],
  ["status: deposit_paid", "yellow-700", "yellow-50"],
  ["status: processing", "blue-700", "blue-50"],
  ["status: shipped", "indigo-700", "indigo-50"],
  ["status: out_for_delivery", "purple-700", "purple-50"],
  ["status: delivered", "green-700", "green-50"],
  ["status: completed", "emerald-700", "emerald-50"],
  ["status: failed", "red-700", "red-50"],
  ["status: refunded", "ink-soft", "paper"],
  ["login error text", "red-700", "bone"],
  ["header error text (dark bar)", "red-400", "ink"],
  ["alert: danger", "red-700", "red-50"],
];

// Tokens that are NOT usable for normal-size text anywhere on this palette, kept
// as an explicit reminder because both are tempting and both look fine by eye:
//   ink-muted  4.34 on bone, 4.06 on paper, 3.69 on paper-deep — large text only
//   sand-dark  3.26 on bone, 3.04 on paper, 2.76 on paper-deep — large text only,
//              and it fails outright on paper-deep. On the dark ink bar it is
//              4.82 and fine.

const srgbToLinear = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function ratio(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

let failed = 0;
console.log(`${"pair".padEnd(32)}${"ratio".padStart(7)}  ${"need".padStart(4)}  verdict`);
for (const [label, fg, bg, large = false] of PAIRS) {
  if (!C[fg] || !C[bg]) {
    console.error(`  unknown colour in "${label}": ${!C[fg] ? fg : bg}`);
    failed++;
    continue;
  }
  const r = ratio(C[fg], C[bg]);
  const need = large ? 3 : 4.5;
  const ok = r >= need;
  if (!ok) failed++;
  console.log(
    `${label.padEnd(32)}${r.toFixed(2).padStart(7)}  ${need.toFixed(1).padStart(4)}  ` +
      `${ok ? "pass" : "FAIL"}${large ? "  (large text)" : ""}`
  );
}

console.log();
if (failed) {
  console.error(`✗ ${failed} of ${PAIRS.length} pairs fail WCAG AA.`);
  process.exit(1);
}
console.log(`✓ all ${PAIRS.length} pairs meet WCAG AA.`);
