import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { items, subtotal, shipping, deliveryMethod } = body;

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Items required" }, { status: 400 });
  }

  // Calculate amounts (all in AED)
  const total = subtotal + (shipping || 0);
  const depositAmount = Math.round(total / 2); // 50% deposit in AED
  const codAmount = total - depositAmount; // remaining 50% COD in AED

  try {
    // Build line items for Stripe — each product at 50% of its price
    // Stripe unit_amount is in fils (1 AED = 100 fils)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
      (item: { name: string; price: number; quantity: number; image?: string; slug?: string }) => ({
        price_data: {
          currency: "aed",
          product_data: {
            name: item.name,
            images: item.image ? [item.image] : [],
            metadata: {
              brand: "lebon-grace",
              entity: "shop-lebon-grace",
              slug: item.slug || "",
            },
          },
          unit_amount: Math.round(item.price * 100 / 2), // 50% in fils
        },
        quantity: item.quantity,
      })
    );

    // Add shipping as separate line item (also at 50%)
    if (shipping && shipping > 0) {
      lineItems.push({
        price_data: {
          currency: "aed",
          product_data: {
            name: "Shipping Fee",
            metadata: { brand: "lebon-grace" },
          },
          unit_amount: Math.round(shipping * 100 / 2), // 50% of shipping in fils
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      payment_intent_data: {
        statement_descriptor_suffix: "LBGRACE",
        metadata: {
          brand: "lebon-grace",
          entity: "shop-lebon-grace",
          order_type: "50_50_split",
          total: String(total),
          subtotal: String(subtotal),
          shipping: String(shipping || 0),
          deposit: String(depositAmount),
          cod_balance: String(codAmount),
          delivery_method: deliveryMethod || "delivery",
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://shop.lebon-grace.com"}/checkout?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://shop.lebon-grace.com"}/checkout?canceled=true`,
      metadata: {
        brand: "lebon-grace",
        entity: "shop-lebon-grace",
        order_type: "50_50_split",
        total: String(total),
        deposit: String(depositAmount),
        cod_balance: String(codAmount),
        delivery_method: deliveryMethod || "delivery",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json({ error: err.message || "Failed to create checkout session" }, { status: 500 });
  }
}
