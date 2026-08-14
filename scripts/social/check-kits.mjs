/**
 * Keep the kits, the HTML and the redirect map honest about each other.
 *
 * These three drift, and it has now happened twice in opposite directions:
 * Instagram and Facebook were written into the HTML and never back-ported to
 * the markdown, then the /go/ campaign links went into the markdown and never
 * reached the HTML. The HTML is the file actually read when posting, so a stale
 * link there is the version that gets pasted into a real post.
 *
 * Three checks, in increasing order of how badly the failure hurts:
 *
 *   1. No bare shop links. A link without a /go/ code posts fine and is simply
 *      invisible in Umami, which is the worst kind of failure: silent.
 *   2. Markdown and HTML agree on the set of codes. Either one being behind
 *      means the two documents disagree about what you are about to post.
 *   3. Every code in the kits has a redirect in next.config.ts. A code with no
 *      redirect 404s, and the click is lost with no trace anywhere.
 *
 * Exits non-zero on any failure so it can gate a commit.
 *
 * Usage:
 *   node scripts/social/check-kits.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const MD = "docs/video/UPLOAD-KITS.md";
const HTML = "docs/video/upload-kits.html";
const CONFIG = "next.config.ts";

const md = read(MD);
const html = read(HTML);
const config = read(CONFIG);

let failed = 0;
const fail = (msg) => { console.log(`FAIL  ${msg}`); failed++; };
const pass = (msg) => console.log(`ok    ${msg}`);

/** Every shop link, whether or not it carries a code. */
const links = (s) => [...s.matchAll(/shop\.lebon-grace\.com(\/go\/([a-z]+))?/g)];
/** Just the codes. */
const codes = (s) => new Set([...s.matchAll(/shop\.lebon-grace\.com\/go\/([a-z]+)/g)].map((m) => m[1]));

// ── 1. no bare links ────────────────────────────────────────────────────────
//
// Two bare mentions are legitimate and must stay bare: the "check the shop is
// up" line in the pre-flight checklist, and the nav/footer chrome in the HTML.
// Those are instructions to the operator, not links anyone posts.
const ALLOWED_BARE = 1;

for (const [file, s] of [[MD, md], [HTML, html]]) {
  const bare = links(s).filter((m) => !m[1]).length;
  if (bare > ALLOWED_BARE) {
    fail(`${file}: ${bare} bare shop link(s), expected at most ${ALLOWED_BARE}. ` +
         `A link with no /go/ code is invisible in Umami.`);
  } else {
    pass(`${file}: no unexpected bare links (${bare} allowed one(s))`);
  }
}

// ── 2. markdown and HTML agree ──────────────────────────────────────────────
const mdCodes = codes(md);
const htmlCodes = codes(html);
const onlyMd = [...mdCodes].filter((c) => !htmlCodes.has(c));
const onlyHtml = [...htmlCodes].filter((c) => !mdCodes.has(c));

if (onlyMd.length || onlyHtml.length) {
  fail(`kits disagree. only in markdown: [${onlyMd}]  only in HTML: [${onlyHtml}]`);
} else {
  pass(`markdown and HTML agree on ${mdCodes.size} code(s): ${[...mdCodes].sort().join(", ")}`);
}

// ── 3. every code actually redirects ────────────────────────────────────────
//
// Parsed from the CHANNELS map rather than by running the app, so this stays
// usable in a pre-commit hook with nothing running.
const declared = new Set(
  [...config.matchAll(/^\s{6}([a-z]+):\s*\[".*?",\s*".*?"\],/gm)].map((m) => m[1]),
);

if (!declared.size) {
  fail(`${CONFIG}: could not parse the CHANNELS map. If it was refactored, update this check.`);
} else {
  const undeclared = [...new Set([...mdCodes, ...htmlCodes])].filter((c) => !declared.has(c));
  if (undeclared.length) {
    fail(`codes used in the kits with no redirect in ${CONFIG}: ${undeclared.join(", ")}. ` +
         `These 404 and the click is lost.`);
  } else {
    pass(`all kit codes have a redirect (${[...declared].sort().join(", ")})`);
  }

  // The reverse is a warning, not a failure: an unused code is dead weight, not
  // a broken link.
  const unused = [...declared].filter((c) => !mdCodes.has(c) && !htmlCodes.has(c));
  if (unused.length) console.log(`note  declared but unused: ${unused.join(", ")}`);
}

console.log(failed ? `\n${failed} check(s) failed` : "\nkits, HTML and redirects agree");
process.exit(failed ? 1 : 0);
