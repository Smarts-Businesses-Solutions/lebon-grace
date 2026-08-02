#!/usr/bin/env node
/**
 * Uploads a current UAE trade licence to Stripe and attaches it to the account.
 *
 * The live account cannot take charges because the card_payments capability is
 * blocked on:
 *
 *   disabled_reason : requirements.fields_needed
 *   past_due        : documents.company_license.files
 *   error           : verification_document_expired
 *                     "Document is expired. Provide a current document."
 *
 * No API call activates a capability directly. card_payments is already
 * `requested: true` and has been since 2026-01-17, so re-requesting it is a
 * no-op. The only thing that moves it is a valid document, which is what this
 * uploads.
 *
 *   node scripts/stripe/upload-license.mjs /path/to/trade-licence.pdf
 *
 * Stripe accepts JPEG, PNG and PDF up to 10MB. The file must be current, and
 * the whole document must be legible: Stripe rejects crops and screenshots that
 * cut off the expiry date, which is what usually causes a second rejection.
 *
 * Verification is manual on Stripe's side and typically takes a business day.
 * Re-run preflight.mjs afterwards rather than assuming it worked.
 */
import Stripe from "stripe";
import { readFileSync, existsSync, statSync } from "fs";
import { basename } from "path";

const API_VERSION = "2026-06-24.dahlia";
const MAX_BYTES = 10 * 1024 * 1024;

const path = process.argv[2];
const KEY = process.env.STRIPE_SECRET_KEY || "";

if (!path) {
  console.error("Usage: node scripts/stripe/upload-license.mjs <path-to-licence.pdf>");
  process.exit(1);
}
if (!existsSync(path)) {
  console.error(`No such file: ${path}`);
  process.exit(1);
}
if (!KEY.startsWith("sk_live_")) {
  // Uploading to the test account would report success and change nothing about
  // the account that actually needs to take money.
  console.error(
    "STRIPE_SECRET_KEY is not a live key. The blocked capability is on the LIVE account;\n" +
      "uploading to test mode would do nothing. Re-run with the live key."
  );
  process.exit(1);
}

const size = statSync(path).size;
if (size > MAX_BYTES) {
  console.error(`File is ${(size / 1024 / 1024).toFixed(1)}MB; Stripe's limit is 10MB.`);
  process.exit(1);
}
if (!/\.(pdf|jpe?g|png)$/i.test(path)) {
  console.error("Stripe accepts PDF, JPEG or PNG for verification documents.");
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: API_VERSION });

const account = await stripe.accounts.retrieve();
console.log(`\n  Account ${account.id} (${account.country})`);
console.log(`  Uploading ${basename(path)} (${(size / 1024).toFixed(0)}KB)\n`);

// purpose must be account_requirement for a document Stripe is asking for as
// part of verification. Other purposes upload fine and satisfy nothing.
const file = await stripe.files.create({
  purpose: "account_requirement",
  file: { data: readFileSync(path), name: basename(path), type: "application/octet-stream" },
});
console.log(`  PASS  Uploaded to Stripe as ${file.id}`);

// Attaching is where this stops being automatable.
//
// accounts.update is a PLATFORM operation. Called with an account's own key it
// returns 403 StripePermissionError, "You cannot use this method on your own
// account: you may only use it on connected accounts." That is a standing
// restriction on direct/standard accounts, not a transient failure or a scope
// problem, so there is no key or parameter that makes it work.
//
// The upload above still runs because it costs nothing and confirms the file is
// the right size, type and purpose before a human retries it by hand.
try {
  await stripe.accounts.update(account.id, {
    documents: { company_license: { files: [file.id] } },
  });
  console.log("  PASS  Attached to company_license on the account");
} catch (err) {
  if (err?.type === "StripePermissionError") {
    console.log(
      "\n  STOP  Stripe will not let an account attach its own verification documents.\n" +
        `        ${err.message}\n\n` +
        "        The file is valid and now sits in your Stripe account, but only the\n" +
        "        Dashboard can submit it against the requirement. In the Stripe\n" +
        "        Dashboard, live mode:\n\n" +
        "          Settings > Business > Verification, or the banner on the home page\n" +
        "          Upload the trade licence where it asks for the company document\n\n" +
        "        Then re-run scripts/stripe/preflight.mjs. Verification is manual on\n" +
        "        Stripe's side and usually takes about a business day.\n"
    );
    process.exit(2);
  }
  throw err;
}

const cap = await stripe.accounts.retrieveCapability(account.id, "card_payments");
const r = cap.requirements || {};
console.log(`\n  card_payments is now: ${cap.status}`);
if ((r.pending_verification || []).length) {
  console.log("  Stripe is reviewing the document. This usually takes about a business day.");
} else if ((r.past_due || []).length || (r.currently_due || []).length) {
  console.log(
    `  Still outstanding: ${[...new Set([...(r.past_due || []), ...(r.currently_due || [])])].join(", ")}`
  );
  (r.errors || []).forEach((e) => console.log(`  ${e.requirement}: ${e.reason}`));
}
console.log("\n  Re-run scripts/stripe/preflight.mjs to confirm before switching to live.\n");
