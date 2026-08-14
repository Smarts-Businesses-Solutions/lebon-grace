/**
 * What can the stored R2 S3 keys actually do?
 *
 * All four CLOUDFLARE_* API tokens in supabase.local are dead, so the
 * Cloudflare REST API is closed to us. The R2 access key pair is a separate
 * credential and may still be account-scoped. R2 implements enough of S3 that
 * ListBuckets and CreateBucket work over the S3 endpoint.
 *
 * This answers three questions before anything is created:
 *   - can the keys see the whole account, or only one bucket?
 *   - can they create a bucket?
 *   - is the existing bucket's public base actually serving?
 *
 * Read-only except for --create, which makes the bucket and nothing else.
 */
import fs from "node:fs";
import { AwsClient } from "aws4fetch";

const SECRETS = "C:/Users/user/Desktop/aprojects/supabase.local";
const BUCKET = "lebon-grace-media";

const env = Object.fromEntries(
  fs.readFileSync(SECRETS, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const ENDPOINT = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const aws = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const show = (label, status, body = "") => {
  const detail = body ? ` ${(body.match(/<Message>([^<]*)</) || [, body.slice(0, 90)])[1]}` : "";
  console.log(`${label.padEnd(34)} ${status}${detail}`);
};

// 1. ListBuckets. Succeeds only for an account-scoped key.
{
  const r = await aws.fetch(ENDPOINT, { method: "GET" });
  const body = await r.text();
  show("ListBuckets", r.status, r.ok ? "" : body);
  if (r.ok) {
    const names = [...body.matchAll(/<Name>([^<]+)<\/Name>/g)].map((m) => m[1]);
    console.log(`  visible buckets: ${names.join(", ")}`);
  }
}

// 2. Does the target already exist?
{
  const r = await aws.fetch(`${ENDPOINT}/${BUCKET}`, { method: "HEAD" });
  show(`HEAD ${BUCKET}`, r.status, "");
}

// 3. Create it, only when asked.
if (process.argv.includes("--create")) {
  const r = await aws.fetch(`${ENDPOINT}/${BUCKET}`, { method: "PUT" });
  const body = await r.text();
  show(`CreateBucket ${BUCKET}`, r.status, r.ok ? "" : body);
}

// 4. Is the currently configured public base really serving? The flywheel
//    depends on anonymous GETs working, and that is a bucket setting the S3
//    API cannot report. Ask the internet instead.
{
  const base = (env.R2_PUBLIC_BASE || "").replace(/\/+$/, "");
  if (!base) { console.log("R2_PUBLIC_BASE               absent"); }
  else {
    const r = await fetch(`${base}/`, { method: "GET" });
    show("anon GET R2_PUBLIC_BASE", r.status, "");
    console.log(`  ${base}`);
  }
}
