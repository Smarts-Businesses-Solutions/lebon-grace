import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface CartItem {
  product: { name: string; price: number; slug: string };
  quantity: number;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, items, total } = body as { email: string; items: CartItem[]; total: number };

  if (!email || !items || items.length === 0) {
    return NextResponse.json({ error: "Email and cart items required" }, { status: 400 });
  }

  const itemList = items
    .slice(0, 5)
    .map((item) => `• ${item.product.name} (x${item.quantity}) — AED ${(item.product.price * item.quantity).toFixed(2)}`)
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
      ${items.length > 5 ? `<p style="font-size:12px;color:#999;margin-top:8px;">+ ${items.length - 5} more items</p>` : ""}
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
      from: "Lebon Grace <onboarding@resend.dev>",
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
