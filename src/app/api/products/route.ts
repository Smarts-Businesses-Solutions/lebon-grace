import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/store";
import { requireAdmin, adminActor } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";

export async function GET(request: NextRequest) {
  // ADMIN ONLY. This was open, and PUT/DELETE being gated made it look
  // considered — a shop's catalogue reads like public information.
  //
  // It is not. These rows carry `cj_pid` and `cj_price`: the supplier's id and
  // the cost we pay. On 2026-08-13 this endpoint handed 611 records to an
  // unauthenticated caller — the entire table, 569 retired products, and a cost
  // price on 515 of them. Anyone could compute the margin on almost everything
  // in the shop.
  //
  // Gating rather than field-stripping because the only consumer is /admin,
  // which already sends the cookie. Nothing public reads this.
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  /*
   * B-42 shipped the audit trail covering only order status changes, and said so
   * — this closes that gap. A price edit is a money change with no receipt: the
   * row simply holds a different number afterwards, and "was this always 15 AED?"
   * had no answer.
   *
   * `updated_at` is stripped from the record: it is a timestamp the code sets,
   * not something the operator chose, and `created_at` on the audit row already
   * says when. Keeping it would pad every entry with noise.
   */
  const { updated_at: _ignored, ...changed } = updates;
  recordAdminAction("product.updated", "product", String(slug), { fields: changed }, adminActor(request));

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

  // The one action with no undo. Without a record, a product that vanishes from
  // the shop leaves no evidence it ever existed, let alone when it went.
  recordAdminAction("product.deleted", "product", String(slug), {}, adminActor(request));

  return NextResponse.json({ success: true });
}
