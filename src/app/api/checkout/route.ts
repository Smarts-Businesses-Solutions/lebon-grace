import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { products } from "@/lib/products";
import { rateLimit } from "@/lib/rate-limit";
import { getAppUrl } from "@/lib/app-url";

export async function POST(request: NextRequest) {
  // Each call creates a Stripe Checkout Session; cap per IP to stop abuse.
  const limited = rateLimit(request, { key: "checkout", limit: 10, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const body = await request.json();
  const { items, shipping, deliveryMethod, emirate, customer } = body as {
    items: Array<{ name: string; price: number; quantity: number; image?: string; slug?: string; personalisation?: string }>;
    subtotal: number;
    shipping: number;
    deliveryMethod: string;
    emirate?: string;
    customer?: { email?: string; phone?: string; name?: string };
  };

  // Trimmed and capped: these are echoed into Stripe metadata and then into the
  // order the workshop reads, so they are not trusted at whatever length arrives.
  const custEmail = String(customer?.email || "").trim().slice(0, 200);
  const custPhone = String(customer?.phone || "").trim().slice(0, 32);
  const custName = String(customer?.name || "").trim().slice(0, 120);

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Items required" }, { status: 400 });
  }

  // ─── SERVER-SIDE PRICE VALIDATION ───
  // Look up each product by slug and use the authoritative price from our catalog
  // Client-sent prices are ignored to prevent price tampering
  const validatedItems = items.map((item) => {
    if (!item.slug) return item;
    const catalogProduct = products.find((p) => p.slug === item.slug);
    if (!catalogProduct) {
      throw new Error(`Unknown product: ${item.slug}`);
    }
    // Trim and cap the engraved name here too: the client limits it, but the
    // client is not a security boundary and this string ends up on Stripe and
    // in the workshop queue.
    const engraved = String(item.personalisation || "").trim().slice(0, 20);
    return {
      ...item,
      name: catalogProduct.name,
      price: catalogProduct.price,
      image: catalogProduct.imageUrl,
      slug: item.slug,
      personalisation: engraved || undefined,
    };
  });

  // Recalculate subtotal from validated prices (ignore client subtotal)
  const subtotal = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Calculate amounts (all in AED)
  const total = subtotal + (shipping || 0);
  // Full payment at checkout. Made-to-order pieces are cut after payment, so
  // the old 50% deposit plus cash on delivery is gone: it added a courier COD
  // fee and meant spending material before being paid.
  const depositAmount = total;
  const codAmount = 0;

  try {
    // Stripe requires product images to be absolute URLs. The catalogue stores
    // them site-relative ("/images/lasercut/x.png"), so passing them straight
    // through made every session create fail with
    //   500 {"error":"Not a valid URL"}
    // and no customer could reach the payment page at all. Anything already
    // absolute (a CDN URL) is left alone.
    const absoluteImage = (src?: string): string[] => {
      if (!src) return [];
      if (/^https?:\/\//i.test(src)) return [src];
      return [`${getAppUrl()}${src.startsWith("/") ? "" : "/"}${src}`];
    };

    // Build line items for Stripe. Orders are charged in full at checkout; the
    // 50% deposit model this once described was removed.
    // Stripe unit_amount is in fils (1 AED = 100 fils)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedItems.map(
      (item: { name: string; price: number; quantity: number; image?: string; slug?: string; personalisation?: string }) => ({
        price_data: {
          currency: "aed",
          product_data: {
            // The engraved name rides on the line item so it appears on the
            // Stripe receipt and in the order the workshop actually reads.
            name: item.personalisation ? `${item.name} (engraved: ${item.personalisation})` : item.name,
            images: absoluteImage(item.image),
            metadata: {
              brand: "lebon-grace",
              entity: "shop-lebon-grace",
              slug: item.slug || "",
              personalisation: item.personalisation || "",
            },
          },
          unit_amount: Math.round(item.price * 100), // full price in fils
        },
        quantity: item.quantity,
      })
    );

    // Delivery as its own line item, charged in full.
    if (shipping && shipping > 0) {
      lineItems.push({
        price_data: {
          currency: "aed",
          product_data: {
            name: "Shipping Fee",
            metadata: { brand: "lebon-grace" },
          },
          unit_amount: Math.round(shipping * 100), // delivery in full
        },
        quantity: 1,
      });
    }

    const session = await stripe().checkout.sessions.create({
      // payment_method_types is deliberately absent. Stripe's guidance is to
      // omit it everywhere except Terminal: including it pins the integration to
      // cards forever, whereas omitting it turns on dynamic payment methods, so
      // what a customer is offered is configured in the Dashboard and adapts to
      // their country and device. Apple Pay, Google Pay and Link appear without
      // a code change, which matters for a UAE storefront on mobile.
      line_items: lineItems,
      mode: "payment",
      // Prefills Stripe's email field, so the customer does not type it twice.
      ...(custEmail ? { customer_email: custEmail } : {}),
      payment_intent_data: {
        statement_descriptor_suffix: "LBGRACE",
        metadata: {
          brand: "lebon-grace",
          entity: "shop-lebon-grace",
          order_type: "full_payment",
          total: String(total),
          subtotal: String(subtotal),
          shipping: String(shipping || 0),
          deposit: String(depositAmount),
          cod_balance: String(codAmount),
          delivery_method: deliveryMethod || "delivery",
          emirate: emirate || "Dubai",
          customer_name: custName,
          customer_phone: custPhone,
        },
      },
      success_url: `${getAppUrl()}/checkout?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getAppUrl()}/checkout?canceled=true`,
      metadata: {
        brand: "lebon-grace",
        entity: "shop-lebon-grace",
        order_type: "full_payment",
        total: String(total),
        deposit: String(depositAmount),
        cod_balance: String(codAmount),
        delivery_method: deliveryMethod || "delivery",
        emirate: emirate || "Dubai",
        // The webhook reads these. session.customer_details.phone is empty
        // unless phone_number_collection is on, and we already asked the
        // customer for it on our own form.
        customer_name: custName,
        customer_phone: custPhone,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json({ error: err.message || "Failed to create checkout session" }, { status: 500 });
  }
}
