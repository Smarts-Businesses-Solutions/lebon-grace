import { NextRequest, NextResponse } from "next/server";
import { reviews, orders as orderStore, orderItems } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Reviews — readable by anyone, writable only by someone holding a delivered
 * order that actually contained the piece.
 *
 * ACTION_PLAN.md A-18. The acceptance criterion is "ratings shown are backed by
 * a real order". Migration 0005 makes half of that structural: `order_id` is a
 * foreign key, so a review cannot exist without an order. This route enforces
 * the half a foreign key cannot express —
 *
 *   1. the submitter knows the order id AND its phone (the same credential
 *      /track uses; there are no accounts on this shop),
 *   2. that order has actually been delivered,
 *   3. that order actually contained this product.
 *
 * Without (3) any delivered order could review the entire catalogue, which is
 * the index-derived fake ratings again with extra steps.
 */

/** Statuses that mean the customer has the piece in their hands. */
const REVIEWABLE_STATUSES = ["delivered", "completed"];

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("slug");
  const orderId = params.get("order");
  const phone = params.get("phone");

  // ?order=…&phone=… — what this customer may review. Behind the same gate and
  // the same rate limit as POST, because it confirms an order exists.
  if (orderId && phone) {
    const limited = rateLimit(request, { key: "review", limit: 10, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const order = await orderStore.getByTracking(orderId, phone);
    if (!order) {
      return NextResponse.json({ error: "Order not found, or the phone does not match." }, { status: 404 });
    }
    if (!REVIEWABLE_STATUSES.includes(String(order.status))) {
      return NextResponse.json({ items: [], delivered: false });
    }
    const items = (await orderItems.getAll()).filter(
      (i: Record<string, unknown>) => String(i.order_id) === String(order.id)
    );
    const already = await reviews.getByOrder(String(order.id));
    const done = new Set(already.map((r: Record<string, unknown>) => String(r.product_slug)));
    return NextResponse.json({
      delivered: true,
      orderId: String(order.id),
      items: items.map((i: Record<string, unknown>) => ({
        slug: String(i.product_slug || ""),
        name: String(i.product_name || "Piece"),
        reviewed: done.has(String(i.product_slug || "")),
      })).filter((i: { slug: string }) => i.slug),
    });
  }

  if (!slug) {
    // No slug: the aggregate map for the catalogue grid.
    return NextResponse.json({ aggregates: await reviews.aggregates() });
  }
  return NextResponse.json({ reviews: await reviews.getBySlug(slug) });
}

export async function POST(request: NextRequest) {
  // Submitting requires guessing an order id + phone pair, so it is an
  // enumeration surface exactly like the order lookup. Same ceiling.
  const limited = rateLimit(request, { key: "review", limit: 10, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const orderId = String(body.orderId || "").trim();
  const phone = String(body.phone || "").trim();
  const slug = String(body.slug || "").trim();
  const rating = Math.round(Number(body.rating));
  const comment = String(body.comment || "").trim().slice(0, 1000);

  if (!orderId || !phone || !slug) {
    return NextResponse.json({ error: "Order, phone and product are all required." }, { status: 400 });
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
  }

  // (1) The credential. getByTracking applies the phone check and the hardened
  // id rules from S-6 — a wrong phone returns null, exactly as on /track.
  const order = await orderStore.getByTracking(orderId, phone);
  if (!order) {
    // Deliberately ambiguous: it must not reveal whether the order exists.
    return NextResponse.json({ error: "Order not found, or the phone does not match." }, { status: 404 });
  }

  // (2) Delivered. Reviewing a piece that has not arrived is not a review.
  if (!REVIEWABLE_STATUSES.includes(String(order.status))) {
    return NextResponse.json(
      { error: "This order has not been delivered yet — you can review it once it arrives." },
      { status: 409 }
    );
  }

  // (3) The order actually contained this piece.
  //
  // Scoped to this order in the database rather than fetched whole and filtered
  // here. This read `orderItems.getAll()`, pulling every order item in the
  // table into memory to inspect one order's worth — while
  // `idx_order_items_order_id` sat unused since the baseline.
  const items = await orderItems.getByOrder(String(order.id));
  const ownsProduct = items.some(
    (i: Record<string, unknown>) => String(i.product_slug) === slug
  );
  if (!ownsProduct) {
    return NextResponse.json({ error: "That order does not include this product." }, { status: 403 });
  }

  if (await reviews.existsFor(order.id, slug)) {
    return NextResponse.json({ error: "You have already reviewed this piece." }, { status: 409 });
  }

  try {
    const saved = await reviews.insert({
      order_id: order.id,
      product_slug: slug,
      rating,
      comment: comment || null,
      // The order's own name, not one supplied with the request — otherwise a
      // reviewer could sign someone else's name to their opinion.
      customer_name: String(order.customer_name || "Customer").slice(0, 80),
    });
    return NextResponse.json({ review: { id: saved.id, rating: saved.rating } }, { status: 201 });
  } catch (err) {
    // 23505 = the UNIQUE(order_id, product_slug) backstop for a double submit
    // that races the check above.
    if ((err as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "You have already reviewed this piece." }, { status: 409 });
    }
    throw err;
  }
}
