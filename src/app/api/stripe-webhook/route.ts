import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendOrderEmail } from "@/lib/email";
import { notifyWhatsApp } from "@/lib/whatsapp";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig || "",
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    // Create order in Supabase using metadata from checkout session
    const total = Number(metadata.total) || (Number(session.amount_total) / 100 * 2);
    const deposit = Number(session.amount_total) / 100; // What Stripe actually charged
    const codBalance = Number(metadata.cod_balance) || (total - deposit);
    const shipping = Number(metadata.shipping) || 0;

    const order = {
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent as string || "",
      customer_name: session.customer_details?.name || "Customer",
      customer_email: session.customer_details?.email || "",
      customer_phone: session.customer_details?.phone || "+971",
      delivery_address: session.customer_details?.address?.line1 || "",
      emirate: "Dubai",
      subtotal: Number(metadata.subtotal) || total - shipping,
      shipping: shipping,
      total: total,
      deposit_amount: deposit,
      cod_amount: codBalance,
      status: "deposit_paid",
      metadata: JSON.stringify({
        brand: metadata.brand || "lebon-grace",
        entity: metadata.entity || "shop-lebon-grace",
        order_type: metadata.order_type || "50_50_split",
        cod_balance: String(codBalance),
        delivery_method: metadata.delivery_method || "delivery",
      }),
    };

    const deliveryMethod = metadata.delivery_method || "delivery";

    const { data, error } = await supabase
      .from("orders")
      .insert(order)
      .select()
      .single();

    if (error) {
      console.error("Order creation failed:", error);
    } else {
      console.log("Order created:", data?.id);

      // Save order items (non-blocking)
      stripe.checkout.sessions.listLineItems(session.id, { expand: ["data.price.product"] }).then((lineItems) => {
        const items = lineItems.data
          .filter((li) => li.description !== "Shipping Fee")
          .map((li) => {
            const product = li.price?.product;
            const slug = typeof product === "object" && product && "metadata" in product ? (product as Stripe.Product).metadata?.slug || "" : "";
            return {
              order_id: data?.id,
              product_slug: slug,
              product_name: li.description || "Product",
              price: (li.amount_total || 0) / 100 / (li.quantity || 1) * 2, // Convert back from 50% deposit
              quantity: li.quantity || 1,
              image_url: typeof product === "object" && product && "images" in product ? (product as Stripe.Product).images?.[0] || "" : "",
            };
          });

        if (items.length > 0) {
          supabase.from("order_items").insert(items).then(({ error: itemsError }) => {
            if (itemsError) console.error("Order items insert failed:", itemsError);
            else console.log(`Saved ${items.length} order items`);
          });
        }
      }).catch(err => console.error("Line items fetch failed:", err));

      // Send confirmation email (non-blocking)
      sendOrderEmail({
        id: data?.id || session.id,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        total: order.total,
        deposit_amount: order.deposit_amount,
        cod_amount: order.cod_amount,
        status: order.status,
        delivery_method: deliveryMethod,
      }, "confirmation").catch(err => console.error("Confirmation email failed:", err));

      // Send WhatsApp notification (non-blocking)
      notifyWhatsApp({
        id: data?.id || session.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        total: order.total,
        deposit_amount: order.deposit_amount,
        cod_amount: order.cod_amount,
        status: "confirmation",
        delivery_method: deliveryMethod,
      }).catch(err => console.error("WhatsApp notification failed:", err));
    }
  }

  return NextResponse.json({ received: true });
}
