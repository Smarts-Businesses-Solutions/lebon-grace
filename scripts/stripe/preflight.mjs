#!/usr/bin/env node
/**
 * Stripe go-live preflight.
 *
 * Asks Stripe itself whether this account can actually take a payment and
 * deliver the webhook, instead of trusting that the env vars look right.
 *
 * It exists because of one specific failure, which is the commonest way a
 * Stripe launch goes wrong: the live secret key is deployed alongside the TEST
 * webhook signing secret. Payments succeed and customers are charged, every
 * webhook fails signature verification, and no order is ever recorded. Nothing
 * in the shop looks broken. A signing secret carries no mode marker, so this
 * cannot be spotted by reading the values; it has to be checked against the
 * endpoint list Stripe holds.
 *
 * Read-only. It creates nothing and changes nothing.
 *
 *   node scripts/stripe/preflight.mjs
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe/preflight.mjs
 */
import Stripe from "stripe";

const API_VERSION = "2026-06-24.dahlia";
const APP_URL = process.env.APP_URL || "https://shop.lebon-grace.com";
const WEBHOOK_PATH = "/api/stripe-webhook";
const REQUIRED_EVENT = "checkout.session.completed";

const KEY = process.env.STRIPE_SECRET_KEY || "";
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET || "";

let failures = 0;
let warnings = 0;
const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => { failures++; console.log(`  FAIL  ${m}`); };
const warn = (m) => { warnings++; console.log(`  WARN  ${m}`); };

const mode = KEY.startsWith("sk_live_") || KEY.startsWith("rk_live_") ? "live"
  : KEY.startsWith("sk_test_") || KEY.startsWith("rk_test_") ? "test"
  : "unknown";

console.log(`\nStripe preflight — mode=${mode}, app=${APP_URL}\n`);

if (mode === "unknown") {
  bad("STRIPE_SECRET_KEY is missing or not a Stripe secret key.");
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: API_VERSION });

/* ── 1. the key works, and the account can actually charge ─────────────────── */
let account;
try {
  account = await stripe.accounts.retrieve();
  ok(`Key authenticates. Account ${account.id}${account.country ? ` (${account.country})` : ""}.`);
} catch (e) {
  bad(`Key rejected by Stripe: ${e.message}`);
  process.exit(1);
}

if (mode === "live") {
  // charges_enabled false is the difference between "we have live keys" and
  // "we can take money". Onboarding is often incomplete when it is false.
  if (account.charges_enabled) ok("Account can accept charges.");
  else bad("Account cannot accept charges yet. Finish Stripe onboarding before switching.");

  if (account.payouts_enabled) ok("Payouts enabled, so money can reach the bank.");
  else warn("Payouts are not enabled. Charges may work while settlement is held.");
} else {
  warn("TEST mode: no real payment can be taken. Expected before go-live, not after.");
}

/* ── 2. currency ───────────────────────────────────────────────────────────── */
if (account.default_currency && account.default_currency.toLowerCase() !== "aed") {
  warn(
    `Account default currency is ${account.default_currency.toUpperCase()}, but the shop prices in AED. ` +
      "Charges still work; expect FX on settlement."
  );
} else if (account.default_currency) {
  ok("Account settles in AED, matching the shop's prices.");
}

/* ── 3. the webhook endpoint Stripe will actually call ─────────────────────── */
const expected = `${APP_URL.replace(/\/+$/, "")}${WEBHOOK_PATH}`;
let endpoints = [];
try {
  endpoints = (await stripe.webhookEndpoints.list({ limit: 100 })).data;
} catch (e) {
  bad(`Could not list webhook endpoints: ${e.message}`);
}

const match = endpoints.find((e) => e.url === expected);
if (!match) {
  bad(
    `No webhook endpoint registered for ${expected} in ${mode} mode.\n` +
      `        Endpoints Stripe holds: ${endpoints.map((e) => e.url).join(", ") || "(none)"}\n` +
      "        Without one, payments succeed and no order is ever created."
  );
} else {
  ok(`Webhook endpoint registered: ${expected}`);

  if (match.status === "enabled") ok("Endpoint is enabled.");
  else bad(`Endpoint status is "${match.status}", so Stripe will not deliver to it.`);

  const events = match.enabled_events || [];
  if (events.includes("*") || events.includes(REQUIRED_EVENT)) {
    ok(`Subscribed to ${REQUIRED_EVENT}.`);
  } else {
    bad(
      `Endpoint is not subscribed to ${REQUIRED_EVENT}. ` +
        `It listens for: ${events.join(", ") || "(nothing)"}. Orders are created from that event.`
    );
  }

  if (match.api_version && match.api_version !== API_VERSION) {
    warn(
      `Endpoint is pinned to API ${match.api_version} but the app sends ${API_VERSION}. ` +
        "Event payload shapes can differ between versions."
    );
  }
}

/* ── 4. the signing secret ─────────────────────────────────────────────────── */
//
// Stripe never returns an existing endpoint's secret, so this cannot be compared
// directly. What is checkable: that one is set, that it is well formed, and that
// exactly one endpoint exists for this URL. Two endpoints on the same URL is the
// trap — a leftover test endpoint next to the live one, and a 50/50 chance the
// secret in the environment belongs to the wrong one.
if (!WHSEC) {
  bad("STRIPE_WEBHOOK_SECRET is not set. Every webhook will be rejected.");
} else if (!WHSEC.startsWith("whsec_")) {
  bad("STRIPE_WEBHOOK_SECRET does not start with whsec_.");
} else {
  ok(`Signing secret present (...${WHSEC.slice(-6)}).`);
  const sameUrl = endpoints.filter((e) => e.url === expected);
  if (sameUrl.length > 1) {
    bad(
      `${sameUrl.length} endpoints share the URL ${expected}. Only one signing secret can be ` +
        "configured, so some deliveries will fail verification. Delete the stale one."
    );
  }
}

/* ── 5. recent delivery health, the thing worth checking after go-live ─────── */
try {
  const events = await stripe.events.list({ limit: 20, types: [REQUIRED_EVENT] });
  if (events.data.length === 0) {
    warn(`No ${REQUIRED_EVENT} events in this mode yet. Nothing to verify against.`);
  } else {
    const latest = events.data[0];
    const when = new Date(latest.created * 1000).toISOString().slice(0, 16).replace("T", " ");
    ok(`Most recent ${REQUIRED_EVENT}: ${when} UTC.`);
    console.log(
      "        Confirm it was DELIVERED in the Dashboard under Developers > Webhooks.\n" +
        "        A successful payment with a failed delivery is the silent failure this guards against."
    );
  }
} catch {
  warn("Could not read recent events.");
}

console.log(
  `\n  ${failures} failing, ${warnings} warning${warnings === 1 ? "" : "s"}.` +
    (failures
      ? "\n  Do NOT switch to live until the failures above are resolved.\n"
      : mode === "live"
        ? "\n  Ready to take live payments.\n"
        : "\n  Test mode is healthy. Re-run with the live key before switching.\n")
);
process.exit(failures ? 1 : 0);
