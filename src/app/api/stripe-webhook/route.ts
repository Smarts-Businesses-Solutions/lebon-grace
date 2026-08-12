import { createHash } from "node:crypto";
import { BRAND } from "@/lib/brand";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, stripeMode } from "@/lib/stripe";
import { orders as orderStore, orderItems } from "@/lib/store";
import { sendOrderEmail, sendOperatorOrderAlert, sendOperatorNotice, esc } from "@/lib/email";
import { notifyWhatsApp } from "@/lib/whatsapp";

/*
 * `.catch` on top of a function documented never to throw, on purpose.
 *
 * `void promise` attaches no rejection handler, and what happens next depends
 * on the environment — which is the problem. Sentry's OnUnhandledRejection
 * integration defaults to `mode: "warn"` and installs a
 * `process.on("unhandledRejection")` handler, and any such handler suppresses
 * Node's own behaviour. But Sentry here is `enabled: NODE_ENV === "production"`,
 * so in dev and test nothing is attached and Node's default applies: the
 * process terminates.
 *
 * So the failure mode is the worst kind — it does not reproduce where you would
 * see it. sendOperatorNotice does catch everything today, but the whole point
 * of these call sites is that they can never take down a Stripe webhook, and
 * that must not rest on a contract two files away staying true through later
 * edits. The cost is four characters.
 */
function notifyOperator(subject: string, html: string): void {
  sendOperatorNotice(subject, html).catch((err) =>
    console.error("[operator-notice] unexpected throw:", err)
  );
}

/**
 * A paid order the workshop cannot make.
 *
 * The console.error beside each call site used to be the whole response, on the
 * belief — written in a comment right here — that "console.error reaches
 * GlitchTip". It did not: `captureConsoleIntegration` is opt-in and had never
 * been configured, so every one of these was a breadcrumb attached to some
 * later event, and B-18 reported to nobody at all. That is now configured in
 * sentry.server.config.ts, but a GlitchTip issue is still a channel the
 * operator has to remember to open. Money has changed hands and a customer is
 * waiting, so this also goes to the address that gets read.
 *
 * Fire-and-forget on purpose: `sendOperatorNotice` resolves false rather than
 * throwing, and awaiting it would put e-mail latency inside a Stripe webhook
 * whose slow reply is a retry — and a retry hits the idempotency guard, so the
 * SECOND delivery would do nothing at all.
 */
function alertNoLineItems(orderId: string, sessionId: string, why: string): void {
  notifyOperator(
    `Paid order ${orderId} has NO LINE ITEMS`,
    `<p><strong>Order ${orderId} has been paid and there is nothing to cut.</strong></p>` +
      `<p>${esc(why)}.</p>` +
      `<p>Stripe session <code>${esc(sessionId)}</code>. Open it, read the line items, and add the ` +
      `pieces to the order by hand — the workshop cannot see this order otherwise, and the ` +
      `customer is already waiting.</p>`
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig || "", process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // This used to be a bare `catch {}` returning 400 with nothing logged, which
    // is the exact shape of the commonest Stripe launch failure: live keys
    // deployed with the TEST signing secret. Customers are charged, every event
    // is rejected here, and no order is created. Silently.
    //
    // Logged loudly, with the mode and a fingerprint of the secret in use, so
    // the mismatch is obvious.
    //
    // This comment used to say "the fingerprint is a truncated hash". It was
    // `.slice(-6)` — the literal tail of the signing secret, written to stdout,
    // to docker logs and (since B-29) to GlitchTip. Now it actually is a hash.
    //
    // It keeps everything the fingerprint was for: the same secret always
    // produces the same value, so an operator can compare the log against what
    // Stripe shows, and two different secrets never collide in practice — which
    // is what makes "live keys deployed with the test signing secret" visible at
    // a glance. Twelve hex characters is 48 bits: far too little to attack a
    // secret with, ample to tell two of them apart.
    const fingerprint = process.env.STRIPE_WEBHOOK_SECRET
      ? createHash("sha256").update(process.env.STRIPE_WEBHOOK_SECRET).digest("hex").slice(0, 12)
      : "UNSET";
    console.error(
      `[stripe-webhook] SIGNATURE VERIFICATION FAILED. mode=${stripeMode()} ` +
        `secret_sha256=${fingerprint} signature_header=${sig ? "present" : "MISSING"}. ` +
        "If payments are succeeding but no orders appear, the signing secret does " +
        "not match this endpoint in the Stripe Dashboard.",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    // ─── IS THIS SALE EVEN OURS? ───
    // The signature check above proves Stripe sent this event. It does NOT
    // prove the sale was ours: this Stripe account serves more than one shop,
    // and Stripe delivers checkout.session.completed to every subscribed
    // endpoint, signed with that endpoint's own secret.
    //
    // Without this, another shop's purchase becomes a lebon-grace order —
    // every field has a fallback waiting (`customer_name || "Customer"`,
    // `emirate || "Dubai"`, total from amount_total), so it would land in the
    // production queue looking real and email a stranger about a puzzle.
    //
    // Positive proof, not a blocklist: excluding brands we know about would
    // admit every shop added to this account later.
    if (metadata.brand !== BRAND) {
      console.log(
        `[stripe-webhook] ignoring session ${session.id} — brand=${metadata.brand || "(none)"}, not this shop.`
      );
      // 200 deliberately. The event is valid, just not ours; a non-2xx makes
      // Stripe retry for days and eventually disable the endpoint, which would
      // take the real orders down with it.
      return NextResponse.json({ received: true, ignored: "not-this-shop" });
    }

    // ─── IDEMPOTENCY CHECK ───
    // If Stripe retries this event, don't create a duplicate order.
    // Must match on the Stripe session id (stored as stripe_session_id), NOT the
    // order's own id — getById() would compare "cs_..." against "ord_..." and
    // never match, so retries slipped through and created duplicate orders.
    const existingOrder = await orderStore.getBySessionId(session.id);
    if (existingOrder) {
      console.log("Duplicate webhook — order already exists:", existingOrder.id);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Create order in local store
    // Stripe now collects the full amount, so amount_total IS the order total.
    // The old code doubled it because only a 50% deposit was charged.
    const total = Number(metadata.total) || Number(session.amount_total) / 100;
    const deposit = Number(session.amount_total) / 100;
    const codBalance = 0;
    const shipping = Number(metadata.shipping) || 0;

    const order = {
      stripe_session_id: session.id,
      stripe_payment_intent: (session.payment_intent as string) || "",
      // Prefer what the customer typed on our own form, carried through Stripe
      // metadata. session.customer_details.phone is only populated when
      // phone_number_collection is enabled on the session, so relying on it
      // alone stored an empty phone on every order, and both Track Order and
      // My Account look orders up by phone.
      customer_name: metadata.customer_name || session.customer_details?.name || "Customer",
      customer_email: session.customer_details?.email || metadata.customer_email || "",
      customer_phone: metadata.customer_phone || session.customer_details?.phone || "",
      delivery_address: session.customer_details?.address?.line1 || "",
      emirate: metadata.emirate || "Dubai",
      subtotal: Number(metadata.subtotal) || total - shipping,
      shipping: shipping,
      total: total,
      deposit_amount: deposit,
      cod_amount: codBalance,
      // `deposit_paid`, not `paid`, despite there no longer being a deposit —
      // this is the key every other surface filters on, and the name is the
      // only thing about it that is stale. Writing `paid` here made each new
      // order invisible: it is in none of STATUS_INDEX (track/TrackClient.tsx:15),
      // PIPELINE_STAGES (components/OperationsDashboard.tsx:37), the admin
      // dropdown (admin/page.tsx:16) or the metrics buckets (api/metrics:27-28),
      // so the customer's tracking timeline lit no step and the order appeared
      // in no column of the production queue — nobody would cut the puzzle, and
      // nothing would say so. Renaming the state everywhere is the better fix
      // and a separate change; agreeing with the other six places is this one.
      status: "deposit_paid",
      metadata: JSON.stringify({
        // Past the guard above, metadata.brand is BRAND by definition — the
        // fallback was covering for a check that did not exist.
        brand: BRAND,
        entity: metadata.entity || "shop-lebon-grace",
        order_type: metadata.order_type || "full_payment",
        cod_balance: String(codBalance),
        delivery_method: metadata.delivery_method || "delivery",
      }),
    };

    const deliveryMethod = metadata.delivery_method || "delivery";

    // Insert the order. The getBySessionId check above catches sequential
    // retries; the UNIQUE(stripe_session_id) constraint is the backstop for a
    // true concurrent race — treat its violation (Postgres 23505) as a duplicate
    // rather than erroring back to Stripe.
    let data;
    try {
      data = await orderStore.insert(order);
    } catch (err) {
      if ((err as { code?: string })?.code === "23505") {
        console.log("Duplicate webhook (race) — unique constraint held");
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw err;
    }
    const orderId = data.id;

    console.log("Order created:", orderId);

    // Captured for the operator alert below, which must be able to say WHAT
    // was ordered and what is engraved without the reader opening /admin.
    let orderedItems: Array<{ product_name: string; quantity: number; personalisation?: string | null }> = [];

    // ─── AWAIT order items insert (not fire-and-forget) ───
    try {
      const lineItems = await stripe().checkout.sessions.listLineItems(session.id, {
        expand: ["data.price.product"],
      });

      const items = lineItems.data
        .filter((li) => li.description !== "Shipping Fee")
        .map((li) => {
          const product = li.price?.product;
          const meta = typeof product === "object" && product && "metadata" in product
            ? (product as Stripe.Product).metadata || {}
            : {};
          const slug = meta.slug || "";
          // The engraved name is what the workshop needs to read off the order.
          const personalisation = meta.personalisation || "";
          return {
            order_id: orderId,
            product_slug: slug,
            product_name: personalisation
              ? `${li.description || "Product"} (engraved: ${personalisation})`
              : (li.description || "Product"),
            // Also stored on its own, because this is the string that gets cut
            // irreversibly into a piece of wood and the workshop queue reads it.
            // It used to exist only inside product_name above, so showing it
            // meant parsing that sentence back apart (0004).
            personalisation: personalisation || null,
            // No doubling: the line item is charged at full price.
            price: (li.amount_total || 0) / 100 / (li.quantity || 1),
            quantity: li.quantity || 1,
            image_url: typeof product === "object" && product && "images" in product
              ? (product as Stripe.Product).images?.[0] || ""
              : "",
          };
        });

      orderedItems = items;

      if (items.length > 0) {
        await orderItems.insertMany(items);
        console.log(`Saved ${items.length} order items`);
      } else {
        // A paid order with nothing to make. It still succeeds — the customer
        // HAS paid and throwing here would make Stripe retry forever — but it
        // must not be silent. This branch had no else at all, and production
        // carries a real order sitting in the cutting queue with zero items as
        // a result. Same family as B-7: the workshop cannot make what it
        // cannot see, and nobody finds out until a customer asks where their
        // puzzle is.
        console.error(
          `[stripe-webhook] order ${orderId} has NO LINE ITEMS — paid but nothing to cut. ` +
            `session=${session.id}. Check the Stripe session's line items and add the pieces by hand.`
        );
        alertNoLineItems(orderId, session.id, "the session came back with an empty item list");
      }
    } catch (err) {
      // Also names the order: "Line items fetch failed" alone left no way to
      // find WHICH order needs repairing.
      console.error(`[stripe-webhook] order ${orderId} has NO ITEMS SAVED — read or write failed:`, err);
      // The try above spans BOTH listLineItems and insertMany, so this fires
      // when the items could not be read AND when they were read but not
      // saved. The alert must not assert which — either way the order has no
      // items in the database and a human has to put them there.
      alertNoLineItems(orderId, session.id, `the items could not be read from Stripe or written to the database: ${String(err)}`);
    }

    // ─── Send notifications (non-blocking, but logged) ───
    const notificationOrder = {
      id: data?.id || session.id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      total: order.total,
      // So the receipt states the delivery actually charged, not a constant.
      subtotal: order.subtotal,
      shipping: order.shipping,
      deposit_amount: order.deposit_amount,
      cod_amount: order.cod_amount,
      status: order.status,
      delivery_method: deliveryMethod,
    };

    sendOrderEmail(notificationOrder, "confirmation")
      .catch((err) => console.error("Confirmation email failed:", err));

    notifyWhatsApp({
      ...notificationOrder,
      status: "confirmation",
    }).catch((err) => console.error("WhatsApp notification failed:", err));

    // Tell the OPERATOR. Nothing did: the two calls above both address the
    // customer, and the maker found out by opening /admin and looking.
    //
    // Fire-and-forget, deliberately. Failing the webhook when this fails would
    // make Stripe retry, and the retry short-circuits on the idempotency check
    // above — so the alert would be skipped permanently rather than resent.
    // Safe here because the app runs as a long-lived standalone Node server,
    // not a serverless function that may freeze once the response is sent.
    sendOperatorOrderAlert(
      { ...notificationOrder, customer_phone: order.customer_phone },
      orderedItems
    ).catch((err) => console.error("[operator-alert] failed:", err));
  }

  /**
   * A refund issued in the Stripe dashboard.
   *
   * Nothing handled this. `checkout.session.completed` was the ONLY event the
   * webhook understood, so refunding a customer in Stripe left the shop with no
   * idea it had happened: the order kept whatever status it had, the customer's
   * tracker went on showing it progressing, and it stayed in the cutting queue —
   * so the workshop could cut a puzzle for an order that had already been paid
   * back. That is B-5's shape ("telling a refunded customer their order is on
   * its way") one layer earlier, and it depended on the operator remembering to
   * repeat the refund by hand in /admin.
   *
   * `refunded` was already a first-class status: it is in the CHECK constraint,
   * it has an email template, and the tracker draws a terminal "Refund complete"
   * card for it (B-19). Only the automatic route into it was missing.
   *
   * Partial refunds are treated as refunds too. Stripe sets `amount_refunded`
   * below `amount` for a partial, but this shop sells single made-to-order
   * pieces at one price — a partial refund here means a human decided something
   * went wrong, and the customer should see that rather than a progress bar.
   */
  if (event.type === "charge.refunded") {
    const charge = event.data.object as {
      payment_intent?: string;
      amount?: number;
      amount_refunded?: number;
    };
    const pi = String(charge.payment_intent || "");
    const order = pi ? await orderStore.getByPaymentIntent(pi) : null;

    if (!order) {
      // Loud, because the alternative is a refunded customer being told their
      // order is on its way. A charge with no matching order is either a
      // payment this shop did not create or an order whose payment_intent was
      // never written.
      console.error(
        `[stripe-webhook] REFUND WITH NO MATCHING ORDER. payment_intent=${pi || "MISSING"}. ` +
          `The customer has their money back and the shop does not know.`
      );
      // No order id to look up, no customer to name, and no status that will
      // ever move — so unlike every other branch here, nothing in the shop will
      // later hint that this happened. It has to be pushed, not left to be
      // found.
      notifyOperator(
        `Refund with NO MATCHING ORDER — payment_intent ${pi || "MISSING"}`,
        `<p><strong>A refund was issued for a payment this shop has no order for.</strong></p>` +
          `<p>payment_intent <code>${esc(pi || "MISSING")}</code>.</p>` +
          `<p>The customer has their money back and the shop does not know who they are. ` +
          `Open this payment in Stripe: either it belongs to a different account, or an ` +
          `order was created without its payment_intent being written.</p>`
      );
    } else if (order.status === "refunded") {
      // Stripe retries, and a partial refund followed by the rest sends the
      // event twice. Neither should re-send the email.
      console.log(`[stripe-webhook] order ${order.id} already refunded, ignoring`);
    } else {
      await orderStore.update(String(order.id), { status: "refunded" });

      sendOrderEmail(
        {
          id: String(order.id),
          customer_name: order.customer_name ?? "Customer",
          customer_email: order.customer_email ?? "",
          customer_phone: order.customer_phone ?? "",
          total: order.total,
          subtotal: order.subtotal,
          shipping: order.shipping ?? undefined,
          deposit_amount: order.deposit_amount,
          cod_amount: order.cod_amount,
          status: "refunded",
          delivery_method: order.delivery_method ?? "delivery",
        },
        "refunded"
      ).catch((err) => console.error("Refund email failed:", err));

      /*
       * The operator was the one person a refund did not reach.
       *
       * The customer got an e-mail and the order moved to "refunded", and that
       * was the whole of it. Meanwhile the money had left the account and the
       * piece may be half-cut on the bench — refunds are the one event where
       * silence costs both cash and material. Placed AFTER the status update so
       * the repeat-event guard above suppresses this too: a partial refund
       * followed by the rest arrives twice, and an alert that fires twice for
       * one refund teaches the operator to skim past it (L-5).
       */
      const refunded = Number(charge.amount_refunded ?? 0) / 100;
      const charged = Number(charge.amount ?? 0) / 100;
      notifyOperator(
        `Refund on order ${order.id} — AED ${refunded.toFixed(2)}`,
        `<p><strong>Order ${order.id} has been refunded.</strong></p>` +
          `<p>AED ${refunded.toFixed(2)} returned of AED ${charged.toFixed(2)} charged` +
          `${refunded < charged ? " — this is a PARTIAL refund" : ""}.</p>` +
          `<p>Customer: ${esc(String(order.customer_name ?? "unknown"))} (${esc(String(order.customer_email ?? "no email"))}).</p>` +
          `<p>If this order is already cut or in progress, stop work on it.</p>`
      );
    }
  }

  /**
   * EVENTS THIS WEBHOOK DELIBERATELY IGNORES.
   *
   * Written down because "no handler" and "we decided not to handle it" look
   * identical in code, and the next person to read this should not have to
   * re-derive it. Checked 2026-08-09 against how this shop is actually wired.
   *
   * `checkout.session.expired` — nothing to act on. The order row is created
   *   ONLY in the completed branch above, so an abandoned checkout has left no
   *   record to update. Cart recovery does not need it either: it is driven from
   *   the browser by CartRecoveryBanner, from the cart in localStorage, not from
   *   anything Stripe knows.
   *
   * `payment_intent.canceled` — cannot apply to an order here. The session uses
   *   `mode: "payment"` with no `capture_method`, so capture is automatic; a
   *   PaymentIntent that gets cancelled is one that never succeeded, and no
   *   order exists for it. If manual capture is ever introduced, this stops
   *   being true and an order COULD be left stranded — that is the moment to
   *   revisit, and the reason this note names the cause rather than the effect.
   *
   * `payout.*` — Stripe moving money to the bank. Says nothing about any order,
   *   and an order's state must never depend on it.
   *
   * Anything unrecognised falls through to the 200 below on purpose. A non-2xx
   * would make Stripe retry an event this endpoint is never going to do
   * anything with.
   */

  return NextResponse.json({ received: true });
}