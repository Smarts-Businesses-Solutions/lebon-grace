import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderEmail } from "@/lib/email";
import { notifyWhatsApp } from "@/lib/whatsapp";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: List all orders, or lookup by id + phone (for tracking), or email + phone (for account)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const phone = searchParams.get("phone");
  const email = searchParams.get("email");

  // Account lookup: email + phone
  if (email && phone) {
    const cleanPhone = phone.replace(/\D/g, "").replace(/^0/, "971");
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .ilike("customer_email", email)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Verify at least one order's phone matches
    const matchingOrders = (data || []).filter((o) => {
      const op = (o.customer_phone || "").replace(/\D/g, "").replace(/^0/, "971");
      return op.endsWith(cleanPhone.slice(-8)) || cleanPhone.endsWith(op.slice(-8));
    });

    if (matchingOrders.length === 0) {
      return NextResponse.json({ error: "No orders found with this email and phone." }, { status: 404 });
    }

    return NextResponse.json({ orders: matchingOrders });
  }

  // Tracking lookup: id + phone required
  if (id && phone) {
    const cleanPhone = phone.replace(/\D/g, "").replace(/^0/, "971");
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .ilike("id", `${id}%`)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Order not found. Please check your order ID." }, { status: 404 });
    }

    // Verify phone matches
    const orderPhone = (data.customer_phone || "").replace(/\D/g, "").replace(/^0/, "971");
    if (!orderPhone.endsWith(cleanPhone.slice(-8)) && !cleanPhone.endsWith(orderPhone.slice(-8))) {
      return NextResponse.json({ error: "Phone number doesn't match this order." }, { status: 403 });
    }

    return NextResponse.json({ order: data });
  }

  // Default: list all (admin)
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

// PUT: Update order status
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, status, tracking_number, courier_name, notes } = body;

  if (!id) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 });
  }

  // Fetch current order to check if status changed
  const { data: currentOrder } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (tracking_number) updates.tracking_number = tracking_number;
  if (courier_name) updates.courier_name = courier_name;
  if (notes) updates.notes = notes;

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send email notification if status changed (non-blocking)
  const updatedOrder = data?.[0];
  if (status && currentOrder && currentOrder.status !== status && updatedOrder) {
    const notificationOrder = {
      id: updatedOrder.id,
      customer_name: updatedOrder.customer_name,
      customer_email: updatedOrder.customer_email,
      customer_phone: updatedOrder.customer_phone,
      total: updatedOrder.total,
      deposit_amount: updatedOrder.deposit_amount,
      cod_amount: updatedOrder.cod_amount,
      status: status,
      delivery_method: updatedOrder.delivery_method,
      tracking_number: tracking_number || updatedOrder.tracking_number,
    };

    sendOrderEmail(notificationOrder, status)
      .catch(err => console.error("Status email failed:", err));

    notifyWhatsApp(notificationOrder)
      .catch(err => console.error("WhatsApp notification failed:", err));
  }

  return NextResponse.json({ success: true, order: updatedOrder });
}
