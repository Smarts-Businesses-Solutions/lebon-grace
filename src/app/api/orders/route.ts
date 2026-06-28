import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: List all orders
export async function GET() {
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
  return NextResponse.json({ success: true, order: data?.[0] });
}
