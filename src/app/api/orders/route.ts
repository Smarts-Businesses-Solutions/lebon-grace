import { NextRequest, NextResponse } from "next/server";
import { orders as orderStore } from "@/lib/store";
import { sendOrderEmail } from "@/lib/email";
import { notifyWhatsApp } from "@/lib/whatsapp";
import { requireAdmin } from "@/lib/admin-auth";

// GET: List all orders, or lookup by id + phone (for tracking), or email + phone (for account)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const phone = searchParams.get("phone");
  const email = searchParams.get("email");

  // Account lookup: email + phone
  if (email && phone) {
    const matchingOrders = await orderStore.getByEmailPhone(email, phone);
    if (matchingOrders.length === 0) {
      return NextResponse.json({ error: "No orders found with this email and phone." }, { status: 404 });
    }
    return NextResponse.json({ orders: matchingOrders });
  }

  // Tracking lookup: id + phone required
  if (id && phone) {
    const order = await orderStore.getByTracking(id, phone);
    if (!order) {
      return NextResponse.json({ error: "Order not found or phone doesn't match." }, { status: 404 });
    }
    return NextResponse.json({ order });
  }

  // Default: list ALL orders — admin only. This branch returns every customer's
  // name/email/phone/address, so it must never be reachable unauthenticated.
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const all = await orderStore.getAll();
  return NextResponse.json(all);
}

// PUT: Update order status (admin only)
export async function PUT(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, status, tracking_number, courier_name, notes } = body;

  if (!id) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 });
  }

  // Fetch current order to check if status changed
  const currentOrder = await orderStore.getById(id);

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (tracking_number) updates.tracking_number = tracking_number;
  if (courier_name) updates.courier_name = courier_name;
  if (notes) updates.notes = notes;

  const updatedOrder = await orderStore.update(id, updates);
  if (!updatedOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Send email notification if status changed (non-blocking)
  if (status && currentOrder && currentOrder.status !== status) {
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