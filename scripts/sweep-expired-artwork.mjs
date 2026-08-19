/**
 * Delete customer artwork that has outlived its purpose.
 *
 * A standalone script rather than an API route, on purpose. A route would be a
 * public endpoint whose only job is deleting things, needing its own secret and
 * its own guard, reachable by anyone who guesses the path. A script run by a
 * systemd timer on cx53 has no attack surface at all. Same shape as the other
 * scheduled work in this repo.
 *
 * WHAT IT DELETES, and why the order matters:
 *
 *   1. the R2 object, first
 *   2. then the database row's pointer to it
 *
 * Reverse that and a failure between the two leaves an orphan in the bucket
 * that nothing in the system knows about: no row references it, so no future
 * sweep will ever find it. That is how a private bucket quietly fills with
 * photographs nobody can account for. This order fails safe instead: if the
 * delete throws, the row still points at a real object and the next run retries.
 *
 * WHAT IT KEEPS. The row survives with its brief, its operator note and its
 * status. The conversation happened and may still matter. What goes is the
 * photograph and the submitter's address, which are the parts the shop has no
 * business holding once a request is dead.
 *
 * Usage:
 *   node scripts/sweep-expired-artwork.mjs --dry
 *   node scripts/sweep-expired-artwork.mjs
 */
import fs from "node:fs";
import { AwsClient } from "aws4fetch";

const DRY = process.argv.includes("--dry");

/*
 * Configuration, from the process environment first and a credential file
 * second.
 *
 * The environment has to win. This runs on a schedule on cx53, where the
 * credentials already exist — they are in the shop container's environment on
 * that same host — and copying them into a second file on the same box would
 * add a place to leak from without adding anything. On the workstation there is
 * no such environment, so it falls back to supabase.local, which is where this
 * project's keys live and is outside the repo because the repo is public.
 *
 * LG_CRED_STORE overrides the file location, matching setup-admin-users.mjs.
 */
const SECRETS =
  process.env.LG_CRED_STORE || "C:/Users/user/Desktop/aprojects/supabase.local";

const fromFile = fs.existsSync(SECRETS)
  ? Object.fromEntries(
      fs
        .readFileSync(SECRETS, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
    )
  : {};

const env = { ...fromFile, ...process.env };

/*
 * The keys for THIS project are stored under an LG_SELFHOSTED_ prefix, because
 * the same file holds credentials for a dozen other Supabase instances and an
 * unprefixed SUPABASE_SERVICE_ROLE_KEY would be ambiguous about which database
 * it opens. The sibling catalog scripts read the same two names.
 */
const SB = env.LG_SELFHOSTED_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.LG_SELFHOSTED_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

/*
 * Every credential is checked up front, including the R2 ones a dry run never
 * touches. A dry run that succeeds and a real run that dies halfway through the
 * batch is the worst possible split, because the dry run is what tells the
 * operator the sweep is safe to schedule.
 */
const need = {
  LG_SELFHOSTED_SUPABASE_URL: SB,
  LG_SELFHOSTED_SERVICE_ROLE_KEY: KEY,
  R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
  LEBON_GRACE_R2_ARTWORK_BUCKET: env.LEBON_GRACE_R2_ARTWORK_BUCKET,
};
for (const [k, v] of Object.entries(need)) {
  if (!v) throw new Error(`${k} missing from supabase.local`);
}

const PG = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const aws = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});
const R2 = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.LEBON_GRACE_R2_ARTWORK_BUCKET}`;

/*
 * The same predicate as findExpiredArtwork in src/lib/design-requests.ts: past
 * its date, still holding a key, not already swept. The partial index in
 * migration 0012 exists for exactly this query.
 *
 * Bounded to 200 a run. A sweep that tries to delete ten thousand objects in
 * one pass and dies halfway is harder to reason about than one that takes
 * several runs and is safely repeatable.
 */
const now = new Date().toISOString();
const query =
  `${SB}/rest/v1/design_requests` +
  `?select=id,reference,artwork_key,expires_at` +
  `&expires_at=lt.${now}` +
  `&artwork_key=not.is.null` +
  `&status=neq.expired` +
  `&limit=200`;

const res = await fetch(query, { headers: PG });
if (!res.ok) throw new Error(`lookup failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
const rows = await res.json();

console.log(`${rows.length} request(s) with artwork past expiry${DRY ? "  (dry run)" : ""}`);

let deleted = 0;
let failed = 0;

for (const row of rows) {
  if (DRY) {
    console.log(`  would delete  ${row.reference}  expired ${row.expires_at.slice(0, 10)}`);
    continue;
  }

  try {
    // 1. storage first
    const del = await aws.fetch(`${R2}/${row.artwork_key}`, { method: "DELETE" });
    // A 404 means the object is already gone, which is the state we wanted.
    if (!del.ok && del.status !== 404) {
      throw new Error(`R2 delete ${del.status}`);
    }

    // 2. then the row. The address goes with the photograph: it was kept to
    //    bound submissions, and once the artwork is gone there is nothing left
    //    to bound.
    const patch = await fetch(`${SB}/rest/v1/design_requests?id=eq.${row.id}`, {
      method: "PATCH",
      headers: PG,
      body: JSON.stringify({
        artwork_key: null,
        artwork_type: null,
        artwork_bytes: null,
        submitter_ip: null,
        status: "expired",
      }),
    });
    if (!patch.ok) throw new Error(`row update ${patch.status}`);

    deleted++;
    console.log(`  swept  ${row.reference}`);
  } catch (err) {
    failed++;
    // Never log the key or the customer's details. The reference is enough to
    // find the row by hand, and it is not sensitive on its own.
    console.log(`  FAILED ${row.reference}: ${err.message}`);
  }
}

if (rows.length > 0 && !DRY) {
  console.log(
    failed
      ? `\n${deleted} swept, ${failed} failed. The failures still hold their artwork and will be retried next run.`
      : `\n${deleted} swept. Nothing left holding expired artwork in this batch.`,
  );
}

/*
 * Non-zero on failure so a timer surfaces it rather than reporting success.
 *
 * Assigned, not process.exit(). Calling exit() while undici still holds a
 * socket trips a libuv assertion on Windows (nodejs/node#58091, #56645) and
 * aborts the process at the C level AFTER the sweep succeeded, which a timer
 * reads as a failed run. Setting exitCode lets the loop drain and the process
 * end on its own. The commonly published workaround is a sleep before exit;
 * draining is the same fix without a magic number, and it is correct on the
 * Linux box this actually runs on too.
 */
process.exitCode = failed ? 1 : 0;
