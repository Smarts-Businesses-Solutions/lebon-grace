import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { orders as orderStore, orderItems } from "@/lib/store";
import { sendOrderEmail } from "@/lib/email";
import { notifyWhatsApp } from "@/lib/whatsapp";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig || "", process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
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
      status: "paid",
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
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
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