#!/usr/bin/env node
/**
 * Verify that a deploy actually reached production.
 *
 * Why this exists (ACTION_PLAN.md A-5, CODEBASE_AUDIT.md R-2): on 2026-08-04/05
 * five consecutive builds reported success while the container kept serving a
 * two-hour-old build. Nothing detected it. A green build is not evidence of a
 * deploy — the only evidence is the running site telling you which build it is.
 *
 * Next writes its `deploymentId` into every asset URL as `?dpl=<id>`, and this
 * project sets it from a `date +%Y%m%d%H%M%S` stamp (next.config.ts:6, passed as
 * the DEPLOYMENT_ID build arg). So the served `dpl=` is both an identity and a
 * sortable build time, which is what makes "did it change?" and "is it newer?"
 * answerable from outside with no access to the host.
 *
 * lebon-grace deploys through the Coolify UI / git push and has NO deploy script
 * (ops/selfhost/PROJECT-CONTEXT.md:236), so this cannot live inside one. Run it
 * after pushing; it polls until the new build appears or it gives up.
 *
 *   node scripts/verify-deploy.mjs                        # report what is live
 *   node scripts/verify-deploy.mjs --changed-from <dpl>   # must stop being <dpl>
 *   node scripts/verify-deploy.mjs --newer-than <dpl>     # must be built after <dpl>
 *   node scripts/verify-deploy.mjs --expect <dpl>         # must become exactly <dpl>
 *
 *   --url <url>        default https://shop.lebon-grace.com
 *   --timeout <secs>   default 600
 *   --interval <secs>  default 15
 *
 * Exits non-zero, with the reason, if the deadline passes without the condition
 * being met. Reading the current build (no comparison flag) always exits 0.
 */

const DEFAULT_URL = "https://shop.lebon-grace.com";

// Proves the app rendered, not that something answered. A container can be
// replaced and still serve an error page, and Cloudflare can return its own
// 200-with-interstitial; either would satisfy a bare status check. Asserting a
// string only the real homepage produces is the paired precondition that makes
// the dpl reading trustworthy.
const SENTINEL = "<title>Lebon Grace";

const DPL_RE = /[?&]dpl=(\d+)/;
const STAMP_RE = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;

function parseArgs(argv) {
  const opts = {
    url: DEFAULT_URL,
    timeout: 600,
    interval: 15,
    mode: "report",
    target: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) fatalUsage(`${arg} needs a value`);
      return v;
    };
    switch (arg) {
      case "--url": opts.url = next(); break;
      case "--timeout": opts.timeout = Number(next()); break;
      case "--interval": opts.interval = Number(next()); break;
      case "--changed-from": opts.mode = "changed"; opts.target = next(); break;
      case "--newer-than": opts.mode = "newer"; opts.target = next(); break;
      case "--expect": opts.mode = "expect"; opts.target = next(); break;
      case "-h": case "--help": fatalUsage(null, 0); break;
      default: fatalUsage(`unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(opts.timeout) || opts.timeout < 0) fatalUsage("--timeout must be a number of seconds");
  if (!Number.isFinite(opts.interval) || opts.interval < 1) fatalUsage("--interval must be at least 1 second");
  if (opts.target !== null && !/^\d+$/.test(opts.target)) {
    fatalUsage(`deployment ids are digits only, got "${opts.target}"`);
  }
  return opts;
}

function fatalUsage(message, code = 2) {
  if (message) console.error(`verify-deploy: ${message}\n`);
  console.error(
    "usage: node scripts/verify-deploy.mjs [--changed-from <dpl> | --newer-than <dpl> | --expect <dpl>]\n" +
    "                                      [--url <url>] [--timeout <secs>] [--interval <secs>]"
  );
  process.exit(code);
}

/**
 * One reading of the live site.
 * Returns { dpl, cache } on success, or { error } describing what went wrong.
 * Never throws: mid-deploy the container is legitimately down, and a poll loop
 * has to be able to tell "not ready yet" from "wrong build".
 */
async function probe(url) {
  // Cache-busted two ways. A CDN hit would report the previous build and read
  // exactly like a failed deploy — the false signal this script exists to
  // eliminate, so it must not be able to produce one itself.
  const bust = `_deploycheck=${process.pid}${Math.random().toString(36).slice(2)}`;
  const target = url + (url.includes("?") ? "&" : "?") + bust;

  let res;
  try {
    res = await fetch(target, {
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    return { error: `request failed: ${err instanceof Error ? err.message : err}` };
  }

  const cache = res.headers.get("cf-cache-status") || "none";
  if (!res.ok) return { error: `HTTP ${res.status}`, cache };

  const html = await res.text();
  if (!html.includes(SENTINEL)) {
    return { error: `HTTP 200 but the homepage did not render (no "${SENTINEL}")`, cache };
  }

  const match = html.match(DPL_RE);
  if (!match) {
    // Not a transient state — this build has version-skew protection switched
    // off, so this script has nothing to read and clients can be served assets
    // from a build that no longer exists.
    return {
      error: "no dpl= in the served HTML — DEPLOYMENT_ID was not passed at build time",
      cache,
      fatal: true,
    };
  }
  return { dpl: match[1], cache };
}

/** Human-readable form of a YYYYMMDDHHMMSS stamp; left alone if it is not one. */
function stamp(dpl) {
  const m = dpl.match(STAMP_RE);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : dpl;
}

function satisfied(mode, live, target) {
  switch (mode) {
    case "changed": return live !== target;
    case "expect": return live === target;
    case "newer":
      // Same-length numeric strings sort lexicographically; fall back to BigInt
      // if a future id changes width.
      return live.length === target.length ? live > target : BigInt(live) > BigInt(target);
    default: return true;
  }
}

const DESCRIBE = {
  changed: (t) => `to stop serving ${t} (${stamp(t)})`,
  newer: (t) => `to serve a build newer than ${t} (${stamp(t)})`,
  expect: (t) => `to serve exactly ${t} (${stamp(t)})`,
};

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // No comparison asked for: report and leave. Used to capture the id BEFORE a
  // deploy, so it can be passed back as --changed-from afterwards.
  if (opts.mode === "report") {
    const r = await probe(opts.url);
    if (r.error) {
      console.error(`✗ ${opts.url} — ${r.error}`);
      process.exit(1);
    }
    console.log(r.dpl);
    console.error(`  ${opts.url} is serving ${r.dpl} (${stamp(r.dpl)}), cf-cache=${r.cache}`);
    return;
  }

  const deadline = Date.now() + opts.timeout * 1000;
  console.error(`waiting for ${opts.url} ${DESCRIBE[opts.mode](opts.target)}`);
  console.error(`  polling every ${opts.interval}s, giving up after ${opts.timeout}s\n`);

  let last = null;
  for (;;) {
    const r = await probe(opts.url);
    last = r;

    if (r.fatal) {
      console.error(`✗ ${r.error}`);
      console.error("  Set DEPLOYMENT_ID as a build arg (next.config.ts reads it) and rebuild.");
      process.exit(1);
    }

    if (r.dpl && satisfied(opts.mode, r.dpl, opts.target)) {
      console.error(`✓ live build is ${r.dpl} (${stamp(r.dpl)}), cf-cache=${r.cache}`);
      return;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const seen = r.error ? r.error : `still ${r.dpl} (${stamp(r.dpl)})`;
    console.error(`  ${seen} — ${Math.round(remaining / 1000)}s left`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(opts.interval * 1000, remaining)));
  }

  // The whole point of the script: say plainly that the deploy did not land,
  // rather than letting a green build stand in as evidence that it did.
  console.error(`\n✗ DEPLOY NOT VERIFIED after ${opts.timeout}s.`);
  if (last?.error) {
    console.error(`  Last reading: ${last.error}`);
    console.error("  The site did not come back healthy. Check the container and the Coolify deploy log.");
  } else {
    console.error(`  ${opts.url} is still serving ${last.dpl} (${stamp(last.dpl)}), cf-cache=${last.cache}`);
    console.error("  The build may have succeeded while the container was never replaced —");
    console.error("  this is exactly the 2026-08-04/05 failure. Check the Coolify deploy log,");
    console.error("  and confirm the image the container is running is the one just built.");
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(`verify-deploy: ${err instanceof Error ? err.stack : err}`);
  process.exit(1);
});
