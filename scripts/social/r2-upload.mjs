/**
 * Push the launch assets to R2 and return their public URLs.
 *
 * Post for Me takes media as { url } and has no file upload endpoint, so the
 * films have to be publicly reachable before anything can be posted. R2 is
 * already in use on this project and its credentials are in supabase.local.
 *
 * SIGNED WITH aws4fetch, not the AWS SDK: R2 is S3-compatible and this needs
 * exactly one thing from that whole surface, a SigV4 PUT. aws4fetch is a few
 * kilobytes against the SDK's tens of megabytes.
 *
 * VERIFIES EVERY UPLOAD by fetching the public URL back and checking the status,
 * content-type and length. A 200 from the PUT only proves R2 accepted the
 * bytes; it says nothing about whether the bucket is actually served publicly,
 * and a post referencing a 403 URL fails silently on the platform side.
 *
 * Usage:
 *   node scripts/social/r2-upload.mjs --dry
 *   node scripts/social/r2-upload.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { AwsClient } from "aws4fetch";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");

const env = Object.fromEntries(
  fs.readFileSync("C:/Users/user/Desktop/aprojects/supabase.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const need = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
const missing = need.filter((k) => !env[k]);
if (missing.length) throw new Error(`missing from supabase.local: ${missing.join(", ")}`);

/**
 * A DEDICATED BUCKET, not the shared R2_BUCKET.
 *
 * R2_BUCKET points at `mirrortales-trailers`, which belongs to another project
 * and is also the home of the `restic-cx53` backup repo. Launch media, another
 * brand's assets and the backups do not belong in one blast radius: a lifecycle
 * rule, a quota or a purge aimed at any one of them would hit the other two.
 *
 * The access keys are account-scoped, so the same pair signs for both buckets.
 */
const BUCKET = env.LEBON_GRACE_R2_BUCKET || "lebon-grace-media";
const PUBLIC = (env.LEBON_GRACE_R2_PUBLIC_BASE || "").replace(/\/+$/, "");

/**
 * Uploading and being publicly fetchable are separate problems, so they are
 * separate outcomes here.
 *
 * Signed PUTs work perfectly against a private bucket. Only the last step,
 * proving an anonymous GET works, needs public access switched on. Refusing to
 * upload at all because that switch is off would block 226 MB of transfer on a
 * setting that does not affect it.
 *
 * So: always upload, always verify the bytes with a signed HEAD, and verify
 * public reachability only when there is a public base to verify against.
 * The manifest the flywheel consumes is written ONLY in the public case,
 * because a manifest of unreachable URLs is worse than no manifest.
 */
const ENDPOINT = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

/**
 * Everything the flywheel might reference, under one prefix.
 *
 * The prefix is versioned by content, not by date: re-running must overwrite
 * the same URLs so a post that is already scheduled keeps pointing at the file
 * it was reviewed with.
 */
const PREFIX = "launch";

const ASSETS = [
  ["remotion-launch/out/making-master.mp4", "making-master.mp4", "video/mp4"],
  ["remotion-launch/out/making-vertical.mp4", "making-vertical.mp4", "video/mp4"],
  ["remotion-launch/out/correction-master.mp4", "correction-master.mp4", "video/mp4"],
  ["remotion-launch/out/correction-vertical.mp4", "correction-vertical.mp4", "video/mp4"],
  ["remotion-launch/out/thumbs/thumb-16x9.png", "thumb-16x9.png", "image/png"],
  ["remotion-launch/out/thumbs/thumb-9x16.png", "thumb-9x16.png", "image/png"],
];

const dry = process.argv.includes("--dry");
const aws = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

console.log(`bucket ${BUCKET}/${PREFIX}/`);
console.log(PUBLIC ? `public ${PUBLIC}\n` : `public ACCESS NOT CONFIGURED, uploading anyway\n`);

const manifest = {};
let failed = 0;
let unreachable = 0;

for (const [rel, name, type] of ASSETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { console.log(`${name.padEnd(26)} SOURCE MISSING`); failed++; continue; }

  const size = fs.statSync(file).size;
  const mb = (size / 1048576).toFixed(1).padStart(6);
  const key = `${PREFIX}/${name}`;
  const url = PUBLIC ? `${PUBLIC}/${key}` : null;

  if (dry) {
    console.log(`${name.padEnd(26)} ${mb} MB  would PUT -> ${url || `s3://${BUCKET}/${key}`}`);
    if (url) manifest[name] = url;
    continue;
  }

  const put = await aws.fetch(`${ENDPOINT}/${BUCKET}/${key}`, {
    method: "PUT",
    body: fs.readFileSync(file),
    headers: {
      "Content-Type": type,
      // A year: these are immutable launch assets at a stable path.
      "Cache-Control": "public, max-age=31536000",
    },
  });
  if (!put.ok) {
    console.log(`${name.padEnd(26)} PUT FAILED ${put.status} ${(await put.text()).slice(0, 120)}`);
    failed++;
    continue;
  }

  // A 200 from the PUT is the API's word for it. Read the object back with a
  // signed HEAD and compare the length, which catches a truncated body.
  const head = await aws.fetch(`${ENDPOINT}/${BUCKET}/${key}`, { method: "HEAD" });
  const stored = Number(head.headers.get("content-length"));
  if (!head.ok || stored !== size) {
    console.log(`${name.padEnd(26)} STORED WRONG: HEAD ${head.status}, ${stored} bytes, expected ${size}`);
    failed++;
    continue;
  }

  if (!url) {
    console.log(`${name.padEnd(26)} ${mb} MB  stored, public access pending`);
    unreachable++;
    continue;
  }

  // Public access being on is a bucket setting the S3 API cannot report, and a
  // post referencing a 403 URL fails silently on the platform side. Ask
  // anonymously, exactly as Post for Me will.
  const anon = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1023" } });
  const okType = (anon.headers.get("content-type") || "").startsWith(type.split("/")[0]);
  if (!(anon.ok || anon.status === 206) || !okType) {
    console.log(`${name.padEnd(26)} stored, BUT ANON GET -> ${anon.status} ${anon.headers.get("content-type")}`);
    unreachable++;
    continue;
  }

  manifest[name] = url;
  console.log(`${name.padEnd(26)} ${mb} MB  ok  ${url}`);
}

// Only write the manifest when every URL in it is proven fetchable. A partial
// manifest would let the flywheel post some assets and silently skip others.
if (!dry && PUBLIC && !failed && !unreachable) {
  const out = path.join(ROOT, "scripts", "social", "media-urls.json");
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log(`\nmanifest: ${out}`);
} else if (!dry) {
  console.log(
    `\nNo manifest written. The bytes are in R2, but the flywheel needs public URLs.\n` +
    `  dash.cloudflare.com > R2 > ${BUCKET} > Settings > Public Development URL > Enable\n` +
    `then add to supabase.local and re-run (re-uploading is idempotent):\n` +
    `  LEBON_GRACE_R2_BUCKET=${BUCKET}\n` +
    `  LEBON_GRACE_R2_PUBLIC_BASE=https://pub-<id>.r2.dev`,
  );
}

console.log(
  failed ? `\n${failed} asset(s) failed to store`
  // Do not claim an upload happened in dry mode. The earlier wording said
  // "uploaded and publicly reachable" on a run that touched no network at all.
  : dry ? `\n${ASSETS.length} asset(s) would be uploaded. Nothing was sent.`
  : unreachable ? `\nall ${ASSETS.length} stored in R2, ${unreachable} not publicly reachable yet`
  : `\nall ${Object.keys(manifest).length} asset(s) uploaded and publicly reachable`,
);
// 1 = bytes did not store, a real failure. 3 = bytes are safe but the flywheel
// still cannot use them. Different problems, different exit codes.
process.exit(failed ? 1 : unreachable ? 3 : 0);
