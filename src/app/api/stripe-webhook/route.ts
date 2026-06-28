import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig || "",
      process.env.STRIPE_WEBHOOK_SECRET || "whsec_ANeMLGLpSN3oq9tJ57D4zfjW2GezHH6y"
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    // Create order in Supabase
    const order = {
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent as string || "",
      customer_name: session.customer_details?.name || "Customer",
      customer_email: session.customer_details?.email || "",
      customer_phone: session.customer_details?.phone || "+971",
      delivery_address: session.customer_details?.address?.line1 || "",
      emirate: "Dubai",
      subtotal: Number(session.amount_total) / 100 * 2 || 0, // Total = 2x deposit
      shipping: 0,
      total: Number(session.amount_total) / 100 * 2 || 0,
      deposit_amount: Number(session.amount_total) / 100 || 0,
      cod_amount: Number(session.amount_total) / 100 || 0,
      status: "deposit_paid",
      metadata: JSON.stringify({
        brand: metadata.brand || "lebon-grace",
        entity: metadata.entity || "shop-lebon-grace",
        cod_balance: "true",
      }),
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(order)
      .select()
      .single();

    if (error) {
      console.error("Order creation failed:", error);
    } else {
      console.log("Order created:", data?.id);
    }
  }

  return NextResponse.json({ received: true });
}
