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

  // Calculate amounts
  const total = subtotal + (shipping || 0);
  const depositAmount = Math.round(total * 50); // 50% in fils (AED smallest unit)
  const codAmount = total - depositAmount;

  try {
    // Build line items for Stripe — each product at 50% of its price
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
      (item: { name: string; price: number; quantity: number; image?: string }) => ({
        price_data: {
          currency: "aed",
          product_data: {
            name: item.name,
            images: item.image ? [item.image] : [],
            metadata: {
              brand: "lebon-grace",
              entity: "shop-lebon-grace",
            },
          },
          unit_amount: Math.round(item.price * 50), // 50% of product price in fils
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
          unit_amount: Math.round(shipping * 50), // 50% of shipping
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
          deposit: String(depositAmount / 100),
          cod_balance: String(codAmount / 100),
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
        deposit: String(depositAmount / 100),
        cod_balance: String(codAmount / 100),
        delivery_method: deliveryMethod || "delivery",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json({ error: err.message || "Failed to create checkout session" }, { status: 500 });
  }
}
