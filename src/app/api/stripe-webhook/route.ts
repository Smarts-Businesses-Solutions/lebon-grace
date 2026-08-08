import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, stripeMode } from "@/lib/stripe";
import { orders as orderStore, orderItems } from "@/lib/store";
import { sendOrderEmail } from "@/lib/email";
import { notifyWhatsApp } from "@/lib/whatsapp";

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
    // the mismatch is obvious. Neither value is itself a secret: the mode is
    // visible in the key prefix and the fingerprint is a truncated hash.
    const fingerprint = (process.env.STRIPE_WEBHOOK_SECRET || "")
      .slice(-6)
      .padStart(6, "*");
    console.error(
      `[stripe-webhook] SIGNATURE VERIFICATION FAILED. mode=${stripeMode()} ` +
        `secret=...${fingerprint} signature_header=${sig ? "present" : "MISSING"}. ` +
        "If payments are succeeding but no orders appear, the signing secret does " +
        "not match this endpoint in the Stripe Dashboard.",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

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
        brand: metadata.brand || "lebon-grace",
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

      if (items.length > 0) {
        await orderItems.insertMany(items);
        console.log(`Saved ${items.length} order items`);
      }
    } catch (err) {
      console.error("Line items fetch failed:", err);
    }

    // ─── Send notifications (non-blocking, but logged) ───
    const notificationOrder = {
      id: data?.id || session.id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      total: order.total,
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
  }

  return NextResponse.json({ received: true });
}