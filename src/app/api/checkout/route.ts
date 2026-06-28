import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { items, total } = body;

  if (!items || !total) {
    return NextResponse.json({ error: "Items and total required" }, { status: 400 });
  }

  // Calculate 50% deposit
  const depositAmount = Math.round(total * 50); // Stripe uses smallest currency unit (fils for AED)
  const codAmount = Math.round(total * 50);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: items.map((item: { name: string; price: number; quantity: number; image?: string }) => ({
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
          unit_amount: Math.round(item.price * 50), // 50% deposit
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      payment_intent_data: {
        statement_descriptor_suffix: "LBGRACE",
        metadata: {
          brand: "lebon-grace",
          entity: "shop-lebon-grace",
          total: String(total),
          deposit: String(depositAmount / 100),
          cod: String(codAmount / 100),
          cod_balance: "true",
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://shop.lebon-grace.com"}/checkout?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://shop.lebon-grace.com"}/checkout?canceled=true`,
      metadata: {
        brand: "lebon-grace",
        entity: "shop-lebon-grace",
        total: String(total),
        deposit: String(depositAmount / 100),
        cod: String(codAmount / 100),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json({ error: err.message || "Failed to create checkout session" }, { status: 500 });
  }
}
