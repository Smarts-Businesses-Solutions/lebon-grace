import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform to match frontend Product interface
  const products = (data || []).map((p) => ({
    slug: p.slug,
    name: p.name,
    price: Number(p.price),
    category: p.category,
    stock: p.stock,
    imageUrl: p.image_url,
    description: p.description,
    cjPid: p.cj_pid,
    cjPrice: p.cj_price,
    variant: p.variant || "Good Value",
  }));

  return NextResponse.json(products);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { slug, name, category, price, stock, imageUrl, description } = body;

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (category !== undefined) updates.category = category;
  if (price !== undefined) updates.price = price;
  if (stock !== undefined) updates.stock = stock;
  if (imageUrl !== undefined) updates.image_url = imageUrl;
  if (description !== undefined) updates.description = description;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("slug", slug)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, product: data?.[0] });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { slug } = body;

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("slug", slug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
