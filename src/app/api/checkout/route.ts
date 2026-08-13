import { NextRequest, NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getProductBySlug } from "@/lib/products";
import { rateLimit } from "@/lib/rate-limit";
import { deliveryFeeFor } from "@/lib/delivery";
import { getAppUrl } from "@/lib/app-url";
import { isDeliverableEmail } from "@/lib/email-address";
import { isUsablePhone } from "@/lib/phone";

export async function POST(request: NextRequest) {
  // Each call creates a Stripe Checkout Session; cap per IP to stop abuse.
  const limited = rateLimit(request, { key: "checkout", limit: 10, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const body = await request.json();
  // `shipping` is deliberately NOT destructured: the body may still carry it
  // (older clients do), and reading it is what SH-03 was. The fee is computed
  // below from the validated subtotal.
  const { items, deliveryMethod, emirate, customer } = body as {
    items: Array<{ name: string; price: number; quantity: number; image?: string; slug?: string; personalisation?: string }>;
    subtotal: number;
    deliveryMethod: string;
    emirate?: string;
    customer?: { email?: string; phone?: string; name?: string };
  };

  // Trimmed and capped: these are echoed into Stripe metadata and then into the
  // order the workshop reads, so they are not trusted at whatever length arrives.
  const custEmail = String(customer?.email || "").trim().slice(0, 200);

  // Server-side too, not only in the browser. The client check is a courtesy
  // to the customer; this one is the actual guarantee, because the form can be
  // bypassed and HTML5 type="email" accepts addresses that cannot receive mail
  // (`a@b` has no TLD). An order whose confirmation cannot be delivered leaves
  // the customer with no way to reach it: tracking needs order-id + phone, and
  // the account lookup needs this same email.
  if (!isDeliverableEmail(custEmail)) {
    return NextResponse.json(
      { error: "Please enter an email address that can receive your order confirmation." },
      { status: 400 }
    );
  }
  const custPhone = String(customer?.phone || "").trim().slice(0, 32);

  // Same argument as the email guard above, for the other half of the
  // credential. The phone is what `/track` and `/account` check, so a phone
  // that cannot be compared is an order the customer can never reach.
  //
  // Nothing validated it server-side: this was `.trim().slice(0, 32)` and
  // that was all. The only check lived in the checkout page and counted
  // CHARACTERS (`form.phone.length < 10`), so "----------" passed it — and
  // being client-side it was never binding on a request that did not come
  // from our own form.
  if (!isUsablePhone(custPhone)) {
    return NextResponse.json(
      {
        error:
          "Please enter the mobile number you want us to reach you on — it is also how you look up your order later.",
      },
      { status: 400 }
    );
  }

  const custName = String(customer?.name || "").trim().slice(0, 120);

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Items required" }, { status: 400 });
  }

  // ─── SERVER-SIDE PRICE VALIDATION ───
  // Look up each product by slug and use the authoritative price from our
  // catalog. Client-sent prices are ignored to prevent price tampering.
  //
  // Every item MUST carry a slug. This previously read `if (!item.slug) return
  // item;`, which meant an item posted without one skipped the catalogue lookup
  // and its client-supplied price went straight onto the Stripe line item —
  // i.e. the caller named their own price. Our own checkout page always sends a
  // slug (src/app/checkout/page.tsx:62), so nothing legitimate is affected; the
  // hole only existed for requests that did not come from our client, which is
  // exactly what this validation is here to stop.
  //
  // Both failure modes answer 400 rather than throwing. The throw sat outside
  // the try/catch below, so an unknown slug escaped the handler and Next
  // answered 500 — reporting a malformed request as a server fault.
  const validatedItems: typeof items = [];
  for (const item of items) {
    if (!item.slug) {
      return NextResponse.json({ error: "Each item must identify a product" }, { status: 400 });
    }
    // getProductBySlug, not products.find: `products` is the LISTED set, so an
    // unlisted item (the internal test product) would not be found here and the
    // order would be refused as "not in the catalogue". This lookup is the price
    // authority — it must see everything sellable, not everything browsable.
    const catalogProduct = getProductBySlug(item.slug);
    if (!catalogProduct) {
      return NextResponse.json({ error: `Unknown product: ${item.slug}` }, { status: 400 });
    }
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      return NextResponse.json({ error: "Quantity must be a positive whole number" }, { status: 400 });
    }
    // Trim and cap the engraved name here too: the client limits it, but the
    // client is not a security boundary and this string ends up on Stripe and
    // in the workshop queue.
    const engraved = String(item.personalisation || "").trim().slice(0, 20);
    validatedItems.push({
      ...item,
      name: catalogProduct.name,
      price: catalogProduct.price,
      image: catalogProduct.imageUrl,
      slug: item.slug,
      quantity: qty,
      personalisation: engraved || undefined,
    });
  }

  // Recalculate subtotal from validated prices (ignore client subtotal)
  const subtotal = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Calculate amounts (all in AED)
  /*
   * The delivery fee is DECIDED HERE, not accepted from the caller.
   *
   * `shipping` used to go from the request body straight into the Stripe line
   * item, so `{"shipping": 0}` bought free delivery — and every record
   * downstream (the order, the confirmation email, the workshop queue) simply
   * repeated whatever Stripe had been told to charge, so nothing could detect
   * it (SH-03). Item prices were already re-read from the catalog; this was the
   * one money value still on trust.
   *
   * Computed from the SERVER's subtotal — the one recomputed from catalog
   * prices just above — because deriving it from the client's number would only
   * launder the same untrusted value through a trustworthy-looking function.
   */
  const deliveryFee = deliveryFeeFor(subtotal, deliveryMethod);
  const total = subtotal + deliveryFee;
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
              brand: BRAND,
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

    // Delivery as its own line item, charged in full — at the fee this server
    // computed, never the one the caller asked for.
    if (deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: "aed",
          product_data: {
            name: "Shipping Fee",
            metadata: { brand: BRAND },
          },
          unit_amount: Math.round(deliveryFee * 100), // delivery in full
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
          brand: BRAND,
          entity: "shop-lebon-grace",
          order_type: "full_payment",
          total: String(total),
          subtotal: String(subtotal),
          shipping: String(deliveryFee),
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
        brand: BRAND,
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
