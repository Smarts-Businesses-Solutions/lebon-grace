#!/usr/bin/env node
/**
 * Adversarial cross-engine sweep.
 *
 *   node scripts/adversarial-sweep.mjs                     # local standalone build
 *   node scripts/adversarial-sweep.mjs --base https://...  # a deployed environment
 *   node scripts/adversarial-sweep.mjs --quick             # baseline pass only
 *
 * Three things distinguish this from the existing E2E suite:
 *
 * 1. It DISCOVERS the surface instead of being told it. A hardcoded route list
 *    can only ever test what somebody remembered; this crawls from `/` and
 *    tests whatever it finds, so a page added next month is covered without
 *    anyone updating a list.
 *
 * 2. It ESCALATES. Running every route against every engine, viewport,
 *    orientation and network condition is thousands of combinations and hours
 *    of wall-clock. So it sweeps a baseline first, then spends the expensive
 *    matrix only on routes that showed a problem — which is where the
 *    information is.
 *
 * 3. It is ADVERSARIAL: it does not check that the happy path works, it tries
 *    to break the page. Offline mid-navigation, the API returning 500, a
 *    request that never resolves, storage denied, tiny viewports, landscape on
 *    a phone.
 *
 * SAFETY. Against a non-local base URL this performs GET navigation only. It
 * never submits a form, never POSTs, and never types into a field that could
 * write. The shop takes live payments; a test sweep must not be able to create
 * an order or send mail.
 */
import { chromium, firefox, webkit, devices } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = (arg("base", "http://127.0.0.1:3105")).replace(/\/$/, "");
const QUICK = args.includes("--quick");
const IS_LOCAL = /127\.0\.0\.1|localhost/.test(BASE);
const OUT = "audits/adversarial-sweep";

const ENGINES = { chromium, firefox, webkit };

/**
 * Viewports chosen to sit ON the edges rather than in comfortable middles.
 *
 * 320 is the narrowest phone still in use and the width most layouts break at.
 * 393/430 are the current Pixel/iPhone Pro Max. 768 is the tablet boundary
 * where a `md:` breakpoint flips. 1280 is the most common desktop. Testing
 * 375 and 1440 would be testing where things already work.
 */
const VIEWPORTS = [
  { name: "320x568-tiny",     width: 320,  height: 568,  touch: true },
  { name: "393x852-pixel",    width: 393,  height: 852,  touch: true },
  { name: "430x932-iphone",   width: 430,  height: 932,  touch: true },
  { name: "768x1024-tablet",  width: 768,  height: 1024, touch: true },
  { name: "1280x800-desktop", width: 1280, height: 800,  touch: false },
];

const findings = [];
const seenKeys = new Set();
function record(f) {
  // Deduplicate: the same defect on 5 viewports is one finding with a list of
  // where it appears, not five findings. Otherwise a single global layout bug
  // drowns everything else.
  const key = `${f.type}|${f.route}|${f.detail}`;
  const existing = findings.find((x) => x.key === key);
  if (existing) { existing.contexts.push(f.context); return; }
  findings.push({ ...f, key, contexts: [f.context] });
  if (!seenKeys.has(key)) seenKeys.add(key);
}

/** Instrument a page so console errors and page crashes become findings. */
function watch(page, route, context) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Chrome logs a console error for every failed subresource; those surface
    // as their own finding via `requestfailed`, so they are not doubled here.
    if (/Failed to load resource/i.test(text)) return;
    record({ type: "console-error", severity: "medium", route, context, detail: text.slice(0, 200) });
  });
  page.on("pageerror", (e) => {
    record({ type: "uncaught-exception", severity: "high", route, context, detail: String(e.message).slice(0, 200) });
  });
  page.on("requestfailed", (r) => {
    const f = r.failure();
    // Aborted requests are normal during navigation; only real failures count.
    if (!f || /ERR_ABORTED|NS_BINDING_ABORTED/i.test(f.errorText)) return;
    record({ type: "request-failed", severity: "medium", route, context,
             detail: `${f.errorText} ${r.url().replace(BASE, "").slice(0, 90)}` });
  });
}

/**
 * The layout checks, run in the page.
 *
 * These target the class of defect that keeps recurring in this project:
 * something overlapping something else at a particular width (SH-02, B-41,
 * EN-02). A screenshot diff would catch it too, but only if a human looks;
 * a geometric assertion fails on its own.
 */
const LAYOUT_PROBE = `(() => {
  const out = { overflow: null, overlaps: [], tinyTargets: [], emptyMain: false, brokenImages: [] };
  const vw = document.documentElement.clientWidth;

  // Horizontal overflow.
  //
  // Measured by ATTEMPTING TO SCROLL, not by comparing scrollWidth to the
  // viewport. The first version compared the two and reported 80 findings; every
  // one was false, because overflow-x:hidden clips the excess and the user
  // cannot scroll at all. scrollWidth is a proxy; being able to scroll is the
  // thing the customer actually experiences.
  const beforeX = window.scrollX;
  window.scrollTo(9999, window.scrollY);
  const canScrollX = window.scrollX > 0;
  window.scrollTo(beforeX, window.scrollY);
  const scrollW = document.documentElement.scrollWidth;
  if (canScrollX) {
    let worst = null;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > vw + 1 && (!worst || r.right > worst.right)) {
        worst = { right: r.right, tag: el.tagName.toLowerCase(),
                  cls: (el.className && el.className.toString ? el.className.toString() : "").slice(0, 60) };
      }
    }
    out.overflow = { scrollWidth: scrollW, viewport: vw, worst };
  }

  // Did anything actually render?
  const main = document.querySelector("main") || document.body;
  out.emptyMain = (main.innerText || "").trim().length < 20;

  // Broken images.
  for (const img of document.querySelectorAll("img")) {
    if (img.complete && img.naturalWidth === 0) {
      out.brokenImages.push((img.getAttribute("src") || "").slice(0, 80));
    }
  }

  // Interactive elements covered by something else at their own centre point.
  // This is the SH-02 / EN-02 shape: a sticky bar sitting over a field.
  const interactive = [...document.querySelectorAll("a,button,input,select,textarea,[role=button]")];
  for (const el of interactive.slice(0, 120)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > vw || cy > window.innerHeight) continue;
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== el && !el.contains(top) && !top.contains(el)) {
      // A CANDIDATE only. elementFromPoint disagreed with Playwright's real
      // hit-testing on every one of the 64 overlaps the first version reported,
      // so this list is now re-checked with a trial click before anything is
      // called a finding.
      out.overlaps.push({
        el: el.tagName.toLowerCase() + (el.type ? "[" + el.type + "]" : ""),
        label: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 40),
        coveredBy: top.tagName.toLowerCase() + "." + (top.className && top.className.toString ? top.className.toString().split(" ")[0] : ""),
      });
    }
  }

  return out;
})()`;

/** Tap-target check, separate because it only applies to touch viewports. */
const TAP_PROBE = `(() => {
  const small = [];
  for (const el of document.querySelectorAll("a,button,input[type=checkbox],input[type=radio],[role=button]")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.height < 24 || r.width < 24) {
      small.push({ el: el.tagName.toLowerCase(),
                   label: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30),
                   size: Math.round(r.width) + "x" + Math.round(r.height) });
    }
  }
  return small.slice(0, 10);
})()`;

async function probe(page, route, context, { touch }) {
  const layout = await page.evaluate(LAYOUT_PROBE).catch(() => null);
  if (!layout) return;

  if (layout.emptyMain) {
    record({ type: "blank-page", severity: "high", route, context,
             detail: "main rendered with almost no text" });
  }
  if (layout.overflow) {
    const w = layout.overflow.worst;
    record({ type: "horizontal-overflow", severity: "medium", route, context,
             detail: `scrollWidth ${layout.overflow.scrollWidth} > viewport ${layout.overflow.viewport}` +
                     (w ? ` — widest: <${w.tag} class="${w.cls}"> to ${Math.round(w.right)}px` : "") });
  }
  // Confirm each overlap candidate by trying to click it. Playwright's
  // actionability check performs a real hit-test at the click point, which is
  // the same question a customer's thumb asks. Only a control that genuinely
  // cannot be clicked is a finding.
  for (const o of layout.overlaps.slice(0, 4)) {
    if (!o.label) continue; // no accessible name to target reliably
    const target = page.getByRole(/button/.test(o.el) ? "button" : "link", { name: o.label, exact: false }).first();
    const blocked = await target
      .click({ trial: true, timeout: 1500 })
      .then(() => null)
      .catch((e) => String(e.message).split(/\r?\n/)[0]);
    if (blocked && /intercepts pointer events|not visible|outside of the viewport/i.test(blocked)) {
      record({ type: "control-unclickable", severity: "high", route, context,
               detail: `${o.el} "${o.label}" cannot be clicked — ${blocked.slice(0, 90)}` });
    }
  }
  for (const src of layout.brokenImages.slice(0, 3)) {
    record({ type: "broken-image", severity: "medium", route, context, detail: src });
  }
  if (touch) {
    const small = await page.evaluate(TAP_PROBE).catch(() => []);
    for (const s of small.slice(0, 3)) {
      record({ type: "tap-target-too-small", severity: "low", route, context,
               detail: `${s.el} "${s.label}" is ${s.size}` });
    }
  }
}

/** Crawl from / to find the reachable surface. Same-origin, GET only. */
async function discoverRoutes(page) {
  const seen = new Set(["/"]);
  const queue = ["/"];
  const routes = [];
  while (queue.length && routes.length < 40) {
    const route = queue.shift();
    const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
    if (!res) continue;
    routes.push({ route, status: res.status() });
    const hrefs = await page.evaluate(`[...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))`).catch(() => []);
    for (const h of hrefs) {
      if (!h || h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("tel:") || h.startsWith("http")) continue;
      const clean = h.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
      if (seen.has(clean)) continue;
      seen.add(clean);
      queue.push(clean);
    }
  }
  return routes;
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log(`\nAdversarial sweep against ${BASE}${IS_LOCAL ? "" : "  (REMOTE — navigation only, no writes)"}\n`);

const browser = await chromium.launch();
const disco = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const discoPage = await disco.newPage();
const routes = await discoverRoutes(discoPage);
await disco.close();

console.log(`Discovered ${routes.length} reachable routes:`);
console.log("  " + routes.map((r) => `${r.route}${r.status !== 200 ? `(${r.status})` : ""}`).join("  "));

// ── pass 1: baseline, every route, one engine, one mobile viewport ───────────
console.log(`\nPass 1 — every route @ chromium 393x852`);
const suspect = new Set();
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
  for (const { route } of routes) {
    const page = await ctx.newPage();
    watch(page, route, "chromium 393x852");
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);
    const before = findings.length;
    await probe(page, route, "chromium 393x852", { touch: true });
    if (findings.length > before) suspect.add(route);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`  ${findings.length} findings; ${suspect.size} routes flagged for escalation`);

if (!QUICK) {
  // ── pass 2: escalate — flagged routes across every engine and viewport ─────
  const escalate = suspect.size ? [...suspect] : routes.slice(0, 3).map((r) => r.route);
  console.log(`\nPass 2 — ${escalate.length} routes x 3 engines x ${VIEWPORTS.length} viewports (+ landscape)`);
  for (const [engineName, engine] of Object.entries(ENGINES)) {
    // WebKit upgrades subresource requests to HTTPS. Against a plain-HTTP base
    // every stylesheet, script and image fails and the page renders blank —
    // which the first run of this script faithfully reported as 1,421 findings,
    // all of them lies. Skip rather than emit noise, and say why.
    if (engineName === "webkit" && BASE.startsWith("http://")) {
      console.log("  webkit SKIPPED — it forces HTTPS for subresources; run with --base https://... to include it");
      continue;
    }
    const br = await engine.launch();
    for (const vp of VIEWPORTS) {
      const orientations = vp.touch
        ? [{ w: vp.width, h: vp.height, tag: "" }, { w: vp.height, h: vp.width, tag: "-landscape" }]
        : [{ w: vp.width, h: vp.height, tag: "" }];
      for (const o of orientations) {
        const ctx = await br.newContext({
          viewport: { width: o.w, height: o.h },
          hasTouch: vp.touch, isMobile: vp.touch && engineName === "chromium",
        });
        for (const route of escalate) {
          const context = `${engineName} ${vp.name}${o.tag}`;
          const page = await ctx.newPage();
          watch(page, route, context);
          await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
          await page.waitForTimeout(300);
          await probe(page, route, context, { touch: vp.touch });
          await page.close();
        }
        await ctx.close();
      }
    }
    await br.close();
    console.log(`  ${engineName} done — ${findings.length} findings so far`);
  }

  // ── pass 3: failure injection ─────────────────────────────────────────────
  console.log(`\nPass 3 — failure injection @ chromium 393x852`);
  const br = await chromium.launch();
  const scenarios = [
    { name: "api-500", setup: async (p) => p.route("**/api/**", (r) => r.fulfill({ status: 500, body: '{"error":"injected"}' })) },
    { name: "api-hangs", setup: async (p) => p.route("**/api/**", async () => { /* never resolve */ }) },
    { name: "images-fail", setup: async (p) => p.route("**/*.{png,jpg,jpeg,webp,avif,svg}", (r) => r.abort()) },
    { name: "offline", setup: async (p) => p.context().setOffline(true) },
  ];
  for (const s of scenarios) {
    const ctx = await br.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
    for (const { route } of routes.slice(0, 8)) {
      const page = await ctx.newPage();
      const context = `chromium 393x852 [${s.name}]`;
      watch(page, route, context);
      await s.setup(page).catch(() => {});
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      // Under injected failure the page must still SAY something. A blank page
      // or a raw stack trace is the defect; a friendly error is a pass.
      const text = await page.evaluate(`(document.body && document.body.innerText || "").trim()`).catch(() => "");
      if (s.name !== "offline" && text.length < 20) {
        record({ type: "blank-under-failure", severity: "high", route, context,
                 detail: `page rendered almost nothing when ${s.name}` });
      }
      if (/TypeError|undefined is not|Cannot read propert|at Object\./.test(text)) {
        record({ type: "stack-trace-shown-to-user", severity: "high", route, context,
                 detail: text.slice(0, 120) });
      }
      await page.close();
    }
    await ctx.close();
    console.log(`  ${s.name} done — ${findings.length} findings so far`);
  }
  await br.close();
}

// ── report ───────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const rank = { high: 0, medium: 1, low: 2 };
findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.type.localeCompare(b.type));

const lines = [
  `# Adversarial sweep — ${BASE}`,
  ``,
  `Engines: chromium, firefox, webkit. Viewports: ${VIEWPORTS.map((v) => v.name).join(", ")}, plus landscape on touch sizes.`,
  `Routes discovered: ${routes.length}. Findings: ${findings.length}.`,
  ``,
];
for (const f of findings) {
  lines.push(`## ${f.severity.toUpperCase()} — ${f.type} — \`${f.route}\``);
  lines.push(``, f.detail, ``, `Seen in ${f.contexts.length} context(s): ${[...new Set(f.contexts)].slice(0, 8).join("; ")}`, ``);
}
writeFileSync(`${OUT}/FINDINGS.md`, lines.join("\n"));
writeFileSync(`${OUT}/findings.json`, JSON.stringify({ base: BASE, routes, findings }, null, 2));

console.log(`\n${"=".repeat(60)}`);
const bySev = findings.reduce((a, f) => ((a[f.severity] = (a[f.severity] || 0) + 1), a), {});
console.log(`FINDINGS: ${findings.length}  (high ${bySev.high || 0}, medium ${bySev.medium || 0}, low ${bySev.low || 0})`);
for (const f of findings.slice(0, 25)) {
  console.log(`  ${f.severity.toUpperCase().padEnd(6)} ${f.type.padEnd(26)} ${f.route.padEnd(22)} ${f.detail.slice(0, 70)}`);
}
console.log(`\nWritten to ${OUT}/FINDINGS.md`);
