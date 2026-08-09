import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { fromAddress } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { getProductBySlug } from "@/lib/products";

const resend = new Resend(process.env.RESEND_API_KEY);

interface CartItem {
  product: { name: string; price: number; slug: string };
  quantity: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// Escape anything that reaches the email HTML. Belt-and-braces: the product
// fields below already come from our own catalog, never the request.
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

export async function POST(request: NextRequest) {
  // This endpoint sends mail from our domain to an address supplied by the
  // caller, so it is the most abusable route in the app. Rate limit hard.
  const limited = rateLimit(request, { key: "cart-recovery", limit: 3, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const body = await request.json();
  const { email, items } = body as { email: string; items: CartItem[]; total: number };

  if (!email || !items || items.length === 0) {
    return NextResponse.json({ error: "Email and cart items required" }, { status: 400 });
  }
  if (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length > 50) {
    return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
  }

  // ─── Resolve every item against OUR catalog ───
  // The request body previously supplied the product name and price, which were
  // interpolated straight into the email HTML — letting anyone send arbitrary
  // HTML mail from this domain. Names and prices now come from the catalog and
  // the caller only chooses a slug and a quantity.
  const resolved = items
    .map((item) => {
      const p = getProductBySlug(String(item?.product?.slug || ""));
      if (!p) return null;
      const qty = Math.min(Math.max(parseInt(String(item?.quantity ?? 1), 10) || 1, 1), 99);
      return { name: p.name, price: p.price, qty };
    })
    .filter((x): x is { name: string; price: number; qty: number } => x !== null);

  if (resolved.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  // Total is recomputed from catalog prices; the client-sent total is ignored.
  const total = resolved.reduce((sum, i) => sum + i.price * i.qty, 0);

  const itemList = resolved
    .slice(0, 5)
    .map((i) => `• ${esc(i.name)} (x${i.qty}) — AED ${(i.price * i.qty).toFixed(2)}`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:#2D2D2D;padding:24px 32px;text-align:center;">
    <h1 style="color:#C9A96E;font-size:24px;margin:0;letter-spacing:3px;">LEBON GRACE</h1>
  </div>
  <div style="background:#C9A96E;padding:20px 32px;text-align:center;">
    <h2 style="color:white;font-size:20px;margin:0;">You left items in your cart! 🛒</h2>
  </div>
  <div style="padding:32px;">
    <p style="font-size:14px;color:#666;line-height:1.6;">Hi there,</p>
    <p style="font-size:14px;color:#666;line-height:1.6;">Looks like you were interested in some items but didn't complete your order. Here's what's waiting for you:</p>
    <div style="background:#f9f9f9;border-radius:12px;padding:24px;margin:24px 0;">
      <p style="font-size:13px;color:#333;white-space:pre-line;">${itemList}</p>
      ${resolved.length > 5 ? `<p style="font-size:12px;color:#999;margin-top:8px;">+ ${resolved.length - 5} more items</p>` : ""}
      <hr style="border:none;border-top:1px solid #eee;margin:12px 0;" />
      <p style="font-size:16px;font-weight:600;color:#2D2D2D;">Cart Total: AED ${total.toFixed(2)}</p>
      <p style="font-size:13px;color:#16A34A;">Pay only 50% now — AED ${(total / 2).toFixed(2)}</p>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="https://shop.lebon-grace.com/cart" style="display:inline-block;padding:14px 32px;background:#16A34A;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Complete Your Order</a>
    </div>
    <p style="font-size:12px;color:#999;text-align:center;margin-top:24px;">
      Questions? Reply to this email or <a href="https://wa.me/971588286630" style="color:#25D366;">WhatsApp us</a>.
    </p>
  </div>
  <div style="background:#2D2D2D;padding:24px 32px;text-align:center;">
    <p style="color:#C9A96E;font-size:14px;letter-spacing:2px;margin:0;">LEBON GRACE</p>
    <p style="color:#666;font-size:11px;margin:8px 0 0 0;">© 2026 Lebon Grace. All rights reserved.</p>
  </div>
</div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: [email],
      subject: "You left items in your cart! 🛒 — Lebon Grace",
      html,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart recovery email failed:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
