/**
 * The social flywheel: one plan, previewed before anything is published.
 *
 * NOTHING POSTS BY DEFAULT. `preview` is the default command and touches no
 * network at all: it builds a local page showing every post exactly as it will
 * be sent, with the actual video playable beside the actual caption. Publishing
 * is a separate, explicit command.
 *
 * That split is deliberate. A post is public and effectively irreversible, and
 * a caption with a stale price in it is worse than no post at all.
 *
 * Copy comes from docs/video/UPLOAD-KITS.md, parsed. The kit is the single
 * source of truth, so fixing a caption there fixes it here, and the two cannot
 * drift into disagreeing about the price.
 *
 * Usage:
 *   node scripts/social/flywheel.mjs            preview (default, offline)
 *   node scripts/social/flywheel.mjs accounts   re-check the live account list
 *   node scripts/social/flywheel.mjs publish    requires --yes, see below
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const KIT = path.join(ROOT, "docs", "video", "UPLOAD-KITS.md");
const OUT_DIR = path.join(ROOT, "scripts", "social");

const env = Object.fromEntries(
  fs.readFileSync("C:/Users/user/Desktop/aprojects/supabase.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

/**
 * The plan.
 *
 * Account IDs were read from the live API, not typed from memory. Instagram and
 * Facebook are connected but deliberately absent: those accounts belong to
 * another brand and are being sorted out separately.
 */
const PLAN = [
  {
    platform: "youtube",
    account: "spc_VZt7FAFb5mjD5Gvc4PO4G",
    handle: "Evariste BONKOUNGOU",
    video: "remotion-launch/out/correction-master.mp4",
    // Section heading in the kit, then which fenced block under it.
    from: { section: "# YouTube", blocks: { title: 0, caption: 1 } },
    limits: { title: 100, caption: 5000 },
  },
  {
    platform: "tiktok",
    account: "spc_xBpujjYW74sdSdRBAA5A",
    handle: "EVABON",
    video: "remotion-launch/out/making-vertical.mp4",
    from: { section: "# TikTok", blocks: { caption: 0, hashtags: 1 } },
    limits: { caption: 2200 },
  },
  {
    platform: "x",
    account: "spc_goIDvNRYbBfDczAlP4NNY",
    handle: "Evarist69967733",
    video: "remotion-launch/out/making-master.mp4",
    from: { section: "# X", blocks: { caption: 0, reply: 1 } },
    // 280 is the free-tier ceiling. Anything longer silently needs Premium.
    limits: { caption: 280, reply: 280 },
  },
];

/** Fenced blocks under a given `# Heading`, in order. */
const blocksUnder = (md, heading) => {
  const start = md.indexOf(`\n${heading}`);
  if (start < 0) throw new Error(`kit has no section "${heading}"`);
  const nextH1 = md.indexOf("\n# ", start + 1);
  const slice = md.slice(start, nextH1 < 0 ? undefined : nextH1);
  /*
   * `\r?\n`, not `\n`. Git normalises this file to CRLF on Windows checkouts,
   * so a fence is followed by \r\n and the stricter pattern matched NOTHING --
   * the preview died with "no block 0 under # YouTube" on a file that was
   * perfectly intact. It would have failed the same way on any fresh clone.
   */
  return [...slice.matchAll(/```[a-z]*\r?\n([\s\S]*?)```/g)].map((m) => m[1].trim());
};

const md = fs.readFileSync(KIT, "utf8");

/**
 * The public URLs, written by r2-upload.mjs only after it has proved each one
 * fetchable anonymously. Absent means the upload has not been run or did not
 * fully verify, and in that case the preview falls back to the local file and
 * says so rather than pretending the media is ready.
 */
const MANIFEST = path.join(OUT_DIR, "media-urls.json");
const media = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};

const posts = PLAN.map((p) => {
  const blocks = blocksUnder(md, p.from.section);
  const text = {};
  for (const [k, i] of Object.entries(p.from.blocks)) {
    if (blocks[i] === undefined) throw new Error(`${p.platform}: no block ${i} under ${p.from.section}`);
    text[k] = blocks[i];
  }
  const file = path.join(ROOT, p.video);
  // Preview the REMOTE file when there is one. Reviewing a local copy proves
  // nothing about the bytes Post for Me will fetch, and those are the bytes
  // that get published.
  const url = media[path.basename(p.video)] || null;
  return { ...p, text, file, url, exists: fs.existsSync(file) };
});

const cmd = process.argv[2] ?? "preview";

// ── accounts ────────────────────────────────────────────────────────────────
if (cmd === "accounts") {
  const r = await fetch("https://api.postforme.dev/v1/social-accounts?limit=100", {
    headers: { Authorization: `Bearer ${env.POSTFORME_ONE_API_KEY}` },
  });
  const j = await r.json();
  // NOTE: without ?limit the API returns a short first page. Asking for the
  // default once made a YouTube account look absent when it was connected.
  for (const a of j.data ?? j) console.log(`${a.platform.padEnd(10)} ${String(a.username).padEnd(26)} ${a.id}`);
  process.exit(0);
}

// ── publish ─────────────────────────────────────────────────────────────────
//
// Three gates, because a post is public and cannot be taken back cleanly:
//   --yes    you have opened the preview and checked every caption and video
//   --live   you actually want these public; without it they are created as
//            drafts, which is the closest thing this API offers to a dry run
//            against the real endpoint
//   posted.json  records what went out, so a re-run cannot silently double-post
const POSTED = path.join(OUT_DIR, "posted.json");

if (cmd === "publish") {
  // --print sends nothing, so it needs no gate. It exists so the exact JSON can
  // be read and argued with before any of it reaches the network, including the
  // disclosure flags, which are claims being made on your behalf.
  const print = process.argv.includes("--print");

  if (!print && !process.argv.includes("--yes")) {
    console.error(
      "publish is blocked without --yes.\n" +
      "Run `preview` first, open the page, and check every caption and video.\n" +
      "Posting is public and cannot be taken back cleanly.",
    );
    process.exit(1);
  }

  const live = process.argv.includes("--live");
  const force = process.argv.includes("--force");
  const at = process.argv.find((a) => a.startsWith("--at="))?.slice(5);

  if (!env.POSTFORME_ONE_API_KEY) { console.error("POSTFORME_ONE_API_KEY missing from supabase.local"); process.exit(1); }

  const notUploaded = posts.filter((p) => !p.url);
  if (notUploaded.length) {
    console.error(
      `${notUploaded.map((p) => p.platform).join(", ")} have no public media URL.\n` +
      `Run: node scripts/social/r2-upload.mjs\n` +
      `Post for Me fetches media over plain HTTPS, so a local file cannot be posted.`,
    );
    process.exit(1);
  }

  // Refuse to repeat a platform that already went out. The API has no natural
  // idempotency key for this, so the record is kept here.
  const already = fs.existsSync(POSTED) ? JSON.parse(fs.readFileSync(POSTED, "utf8")) : {};
  const repeats = posts.filter((p) => already[p.platform] && !force);
  if (repeats.length) {
    console.error(
      `already posted: ${repeats.map((p) => `${p.platform} (${already[p.platform].id}, ${already[p.platform].at})`).join(", ")}\n` +
      `Pass --force only if you genuinely want a second post on those platforms.`,
    );
    process.exit(1);
  }

  console.log(live ? "PUBLISHING FOR REAL\n" : "creating DRAFTS (add --live to publish)\n");

  /**
   * Per-platform payload.
   *
   * The AI disclosures are not optional politeness. Both films carry
   * Veo-generated footage, and YouTube and TikTok each ask directly whether
   * the upload contains synthetic media. Answering honestly is the only
   * defensible setting for a brand whose entire pitch is checkable claims.
   *
   * made_for_kids is FALSE on purpose. The product is for ages 3 to 6 but the
   * film is addressed to the adult buying it, and YouTube's flag is about who
   * the content is directed at, not who the product is for. Setting it true
   * would disable comments on a launch video for no reason.
   */
  const payloadFor = (p) => {
    const media = [{ url: p.url }];
    const base = { social_accounts: [p.account], media, is_draft: !live };
    if (at) base.scheduled_at = at;

    if (p.platform === "youtube") {
      return {
        ...base,
        caption: p.text.caption,
        platform_configurations: {
          youtube: {
            title: p.text.title,
            description: p.text.caption,
            privacy_status: "public",
            made_for_kids: false,
            contains_synthetic_media: true,
            localizations: null,
          },
        },
      };
    }

    if (p.platform === "tiktok") {
      // Hashtags live in the caption on TikTok; there is no separate field.
      const caption = `${p.text.caption}\n\n${p.text.hashtags}`;
      return {
        ...base,
        caption,
        platform_configurations: {
          tiktok: {
            privacy_status: "PUBLIC_TO_EVERYONE",
            is_ai_generated: true,
            allow_comment: true,
            allow_duet: true,
            allow_stitch: true,
            // The foley is the content. Do not let the platform lay music over it.
            auto_add_music: false,
          },
        },
      };
    }

    return { ...base, caption: p.text.caption, platform_configurations: { x: {} } };
  };

  if (print) {
    for (const p of posts) {
      console.log(`── ${p.platform} ── ${p.handle}`);
      console.log(JSON.stringify(payloadFor(p), null, 2));
      console.log();
    }
    console.log("POST https://api.postforme.dev/v1/social-posts  (nothing was sent)");
    process.exit(0);
  }

  const results = {};
  for (const p of posts) {
    const body = payloadFor(p);
    const r = await fetch("https://api.postforme.dev/v1/social-posts", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.POSTFORME_ONE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.log(`${p.platform.padEnd(9)} FAILED ${r.status}  ${JSON.stringify(j).slice(0, 300)}`);
      continue;
    }
    console.log(`${p.platform.padEnd(9)} ${live ? "posted" : "draft "}  id=${j.id ?? "?"}  ${j.status ?? ""}`);
    results[p.platform] = { id: j.id, at: new Date().toISOString(), live, url: p.url };
  }

  // Only record real posts. A draft is not something a re-run must protect against.
  if (live && Object.keys(results).length) {
    fs.writeFileSync(POSTED, JSON.stringify({ ...already, ...results }, null, 2));
    console.log(`\nrecorded: ${POSTED}`);
  }

  /**
   * Two things this API cannot do, printed every time rather than buried in a
   * doc, because silently dropping them would look like success.
   */
  const xPost = posts.find((p) => p.platform === "x");
  console.log(
    `\nSTILL MANUAL:\n` +
    `  1. The X self-reply. TwitterConfigurationDto has quote_tweet_id and\n` +
    `     reply_settings but no reply-to field, so threads cannot be built here.\n` +
    `     Post this yourself as a reply to the tweet above:\n\n` +
    `${xPost.text.reply.split("\n").map((l) => `       ${l}`).join("\n")}\n\n` +
    `  2. The YouTube thumbnail. YoutubeConfigurationDto has no thumbnail field.\n` +
    `     Set it in YouTube Studio from remotion-launch/out/thumbs/thumb-16x9.png`,
  );

  process.exit(0);
}

// ── preview (default, offline) ──────────────────────────────────────────────
const meta = async (f) => {
  if (!fs.existsSync(f)) return null;
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "default=nw=1:nk=1", f,
  ]);
  const [w, h, d] = stdout.trim().split(/\r?\n/);
  return { w: +w, h: +h, secs: +d, mb: fs.statSync(f).size / 1048576 };
};

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const cards = [];
let problems = 0;

for (const p of posts) {
  const m = await meta(p.file);
  const rows = Object.entries(p.text).map(([k, v]) => {
    const limit = p.limits[k];
    const over = limit && v.length > limit;
    if (over) problems++;
    return `<div class="field">
      <div class="fname">${k}${limit ? ` <span class="lim ${over ? "over" : ""}">${v.length} / ${limit}</span>` : ""}</div>
      <pre>${esc(v)}</pre>
    </div>`;
  }).join("");

  if (!p.exists) problems++;
  if (p.exists && !p.url) problems++;

  cards.push(`<article>
    <header>
      <span class="plat ${p.platform}">${p.platform}</span>
      <strong>${esc(p.handle)}</strong>
      <code>${p.account}</code>
    </header>
    <div class="body">
      <div class="vid">
        ${p.exists
          ? `<video src="${p.url || path.relative(OUT_DIR, p.file).replace(/\\/g, "/")}" controls preload="metadata"></video>
             <div class="vmeta">${m.w}×${m.h} · ${m.secs.toFixed(1)}s · ${m.mb.toFixed(1)} MB<br>
               ${p.url
                 ? `<span class="live">streaming from R2, this is the exact file that will be posted</span><br><code>${p.url}</code>`
                 : `<span class="localonly">LOCAL COPY. Not uploaded, so this is not yet postable.</span><br><code>${p.video}</code>`}
             </div>`
          : `<div class="missing">FILE MISSING<br><code>${p.video}</code></div>`}
      </div>
      <div class="fields">${rows}</div>
    </div>
  </article>`);
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flywheel preview</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500&family=Karla:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#23201c;--soft:#5a5248;--faint:#8a8074;--paper:#f7f3ec;--card:#fffdf9;--rule:#e2d9cb;--sand:#c9a96e;--no:#a4553f;--ok:#4a7c59}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:400 16px/1.6 Karla,system-ui,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:56px 28px 90px}
h1{font:300 46px/1.1 Fraunces,Georgia,serif;margin:0 0 10px}
.lede{color:var(--soft);margin:0 0 8px;max-width:62ch}
.status{display:inline-block;margin:18px 0 40px;padding:9px 16px;border-radius:100px;font-weight:500;font-size:14px}
.clean{background:#e8f0e9;color:var(--ok)}.dirty{background:#f6e7e2;color:var(--no)}
article{background:var(--card);border:1px solid var(--rule);border-radius:14px;margin:0 0 26px;overflow:hidden}
header{display:flex;align-items:center;gap:12px;padding:15px 20px;border-bottom:1px solid var(--rule);flex-wrap:wrap}
.plat{font:500 11px Karla;letter-spacing:.14em;text-transform:uppercase;padding:5px 11px;border-radius:100px;background:var(--ink);color:var(--paper)}
header code{margin-left:auto;color:var(--faint);font-size:12px}
.body{display:grid;grid-template-columns:300px 1fr;gap:22px;padding:20px}
video{width:100%;border-radius:9px;background:#000;display:block}
.vmeta{margin-top:9px;font-size:12.5px;color:var(--faint);line-height:1.5}
.missing{padding:40px 16px;text-align:center;background:#f6e7e2;color:var(--no);border-radius:9px;font-weight:700}
.live{color:var(--ok);font-weight:500}
.localonly{color:var(--no);font-weight:700}
.fname{font:500 11.5px Karla;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);margin:0 0 6px}
.field{margin:0 0 16px}
.lim{color:var(--ok);letter-spacing:0;text-transform:none;font-weight:400}
.lim.over{color:var(--no);font-weight:700}
pre{background:var(--paper);border:1px solid var(--rule);border-radius:9px;padding:14px 16px;margin:0;
    white-space:pre-wrap;word-wrap:break-word;font:400 14px/1.65 Karla,monospace}
@media(max-width:760px){.body{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<h1>Flywheel preview</h1>
<p class="lede">Exactly what will be posted, where, and with which file. Nothing
has been sent. Check every caption and play every video before approving.</p>
<div class="status ${problems ? "dirty" : "clean"}">${problems ? `${problems} problem(s) to fix` : "all checks pass"}</div>
${cards.join("\n")}
</div></body></html>`;

const out = path.join(OUT_DIR, "preview.html");
fs.writeFileSync(out, html);

console.log(`${posts.length} post(s) planned\n`);
for (const p of posts) {
  const m = await meta(p.file);
  const where = p.url ? "R2" : p.exists ? "LOCAL ONLY, not postable" : "";
  console.log(`  ${p.platform.padEnd(9)} ${p.handle.padEnd(22)} ${p.exists ? `${m.w}x${m.h} ${m.secs.toFixed(0)}s ${m.mb.toFixed(0)}MB  ${where}` : "FILE MISSING"}`);
  for (const [k, v] of Object.entries(p.text)) {
    const lim = p.limits[k];
    const flag = lim && v.length > lim ? ` OVER LIMIT (${v.length}/${lim})` : "";
    console.log(`     ${k.padEnd(9)} ${String(v.length).padStart(5)} chars${flag}`);
  }
}
console.log(`\npreview: ${out}`);
console.log(problems ? `${problems} problem(s) above` : "no problems found");
console.log("\nnothing has been posted. publishing is a separate command and needs --yes.");
