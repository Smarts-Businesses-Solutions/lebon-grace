import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/store";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  // The live catalog ships in src/lib/products.ts. This endpoint returns any
  // Supabase-style overrides/imports stored locally (imported data wins).
  const overrides = await catalog.getAll();
  return NextResponse.json(overrides);
}

export async function PUT(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  await catalog.upsert({ slug, ...updates });
  return NextResponse.json({ success: true, product: { slug, ...updates } });
}

export async function DELETE(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { slug } = body;

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  await catalog.remove(slug);
  return NextResponse.json({ success: true });
}
