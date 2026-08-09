import { Resend } from "resend";
import { getAppUrl } from "./app-url";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sender for all outbound mail.
 *
 * Was hardcoded to `onboarding@resend.dev` — Resend's SHARED SANDBOX domain,
 * which only ever delivers to the Resend account owner. Every order email this
 * app has "sent" went nowhere. That is separate from the account being in test
 * mode: the sandbox domain would keep failing even after test mode is lifted.
 *
 * MAIL_FROM_ADDRESS is read first and is deliberately provider-neutral, so the
 * planned move from Resend to Postal/SES needs no code change. RESEND_FROM_ADDRESS
 * is the name two other apps in this estate already use and is honoured as a
 * fallback. The literal default is a real address on lebon-grace.com, which is a
 * verified SES identity with DKIM — so it works on either provider.
 */
export function fromAddress(): string {
  return (
    process.env.MAIL_FROM_ADDRESS ||
    process.env.RESEND_FROM_ADDRESS ||
    "Lebon Grace <orders@lebon-grace.com>"
  );
}

interface EmailOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total: number;
  deposit_amount: number;
  cod_amount: number;
  status: string;
  delivery_method: string;
  /** Real figures from the order. Without these the summary had to guess. */
  subtotal?: number;
  shipping?: number;
  tracking_number?: string;
}

function formatPrice(amount: number): string {
  return `AED ${amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The one list. An action is emailable if and only if it has an entry here.
 *
 * This was previously two things that could drift: a `switch` for subjects and a
 * `statusMap` for bodies, with the body falling back to `statusMap.confirmation`
 * for anything unmapped. Four of the eight statuses the admin dropdown can set —
 * `deposit_paid`, `completed`, `failed` and `refunded` — had no entry, so every
 * one of them emailed the customer **"Order Confirmed! Thank you for your order.
 * We're preparing your items now."** under the subject "Order Update".
 *
 * Refunding someone and telling them their order is confirmed and being prepared
 * is the worst of those, and it was the default behaviour.
 *
 * Deriving both subject and body from a single map means the failure cannot
 * recur: an action with no entry now sends nothing at all (see sendOrderEmail),
 * and adding a template is the single act that makes a status emailable.
 *
 * Deliberately absent, because silence is correct for them:
 *   deposit_paid  the opening state — the webhook already sent `confirmation`.
 *                 An admin moving an order back must not re-confirm it.
 *   paid          transitional webhook value (see migration 0002); never a
 *                 customer-facing transition.
 *   completed     internal bookkeeping after `delivered`, which already thanked
 *                 them. A second "done!" mail is noise.
 *   failed        payment failure is Stripe's conversation with the customer;
 *                 a later mail from us only confuses it.
 */
const TEMPLATES: Record<
  string,
  { subject: (id: string) => string; title: string; color: string; message: (o: EmailOrder) => string }
> = {
  confirmation: {
    subject: (id) => `Order Confirmed #${id} — Lebon Grace`,
    title: "Order Confirmed!",
    color: "#16A34A",
    message: () => "Thank you for your order. We're preparing your items now.",
  },
  processing: {
    subject: (id) => `Order Update: Your order #${id} is being prepared`,
    title: "Order Being Prepared",
    color: "#2563EB",
    message: () => "Your order is being prepared and will ship soon.",
  },
  shipped: {
    subject: (id) => `Your order #${id} has shipped! 🚚`,
    title: "Your Order Has Shipped!",
    color: "#7C3AED",
    message: (o) =>
      o.tracking_number
        ? `Your order is on its way! Tracking: ${o.tracking_number}`
        : "Your order is on its way! We'll send tracking details soon.",
  },
  out_for_delivery: {
    subject: (id) => `Your order #${id} arrives today!`,
    title: "Arriving Today!",
    color: "#EA580C",
    message: (o) =>
      `Your order is out for delivery. ${
        o.cod_amount > 0 ? `Please have ${formatPrice(o.cod_amount)} ready for the courier.` : ""
      }`.trim(),
  },
  delivered: {
    subject: (id) => `Thank you! Your order #${id} is delivered ✅`,
    title: "Order Delivered!",
    // The review invitation rides on the delivered email rather than a separate
    // one sent days later (A-18). There is no scheduler in this estate, and an
    // ask that never fires is worse than one that arrives slightly early. If a
    // cron ever exists, give it its own `review_request` entry here.
    //
    // The link carries the order id and phone because those ARE the credential
    // on this shop — there are no accounts — and /api/reviews re-checks both.
    color: "#16A34A",
    message: (o) =>
      "Your order has been delivered. We hope you love it! " +
      `If you have a moment, telling us what you think helps other parents choose: ` +
      `${getAppUrl()}/review?order=${encodeURIComponent(o.id)}`,
  },
  cancelled: {
    subject: (id) => `Order #${id} cancelled — Lebon Grace`,
    title: "Order Cancelled",
    color: "#DC2626",
    message: () =>
      "Your order has been cancelled. As a reminder, all sales are final and we do not offer refunds. If you believe this was an error, please contact our support team.",
  },
  refunded: {
    // New. This is the one that was silently sending "Order Confirmed!".
    // Deliberately does not repeat the "all sales are final" line from
    // `cancelled` — a refund has already been issued, so quoting the no-refunds
    // policy back at the customer reads as a contradiction.
    subject: (id) => `Refund issued for order #${id} — Lebon Grace`,
    title: "Refund Issued",
    color: "#6B7280",
    message: (o) =>
      `We have refunded ${formatPrice(o.total)} for this order. Refunds usually reach your account within 5–10 working days, depending on your bank. If it has not arrived by then, reply to this email and we will chase it.`,
  },
};

/** True when this action has a template, i.e. when it should reach a customer. */
export function isEmailable(action: string): boolean {
  return Object.hasOwn(TEMPLATES, action);
}

function getEmailSubject(order: EmailOrder, action: string): string {
  return TEMPLATES[action].subject(order.id.slice(0, 8));
}

function buildEmailHTML(order: EmailOrder, action: string): string {
  // The per-item table that used to be built here was never inserted into the
  // template, and neither caller passes `items` anyway — so no order email has
  // ever listed what was ordered. Removed rather than left as dead code;
  // restoring it means passing items from both callers, which is its own task.

  // No `|| TEMPLATES.confirmation` fallback: sendOrderEmail refuses unmapped
  // actions before reaching here, so an absent template can no longer be
  // silently replaced by a wrong one.
  // Was: Subtotal printed order.total, Delivery was hardcoded to AED 25 with a
  // "free over 300" rule, and a "Pay on delivery (COD)" row always showed
  // AED 0.00. The shop charges AED 20, free over AED 150 (UAE_DELIVERY and
  // FREE_DELIVERY_OVER in cart-context, pinned by its test), and COD was
  // removed when checkout moved to full payment. So every receipt quoted a
  // delivery price the shop does not charge, under a threshold it does not use.
  //
  // These now come from the order. Falling back to arithmetic on the total
  // rather than to a constant means a missing field cannot reintroduce a
  // made-up number.
  const shipping = typeof order.shipping === "number" ? order.shipping : 0;
  const subtotal = typeof order.subtotal === "number" ? order.subtotal : order.total - shipping;
  const shippingLabel =
    order.delivery_method === "pickup" ? "Free (workshop collection)"
    : shipping > 0 ? formatPrice(shipping)
    : "Free";

  const t = TEMPLATES[action];
  const status = { title: t.title, color: t.color, message: t.message(order) };

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <!-- Header -->
  <div style="background:#2D2D2D;padding:24px 32px;text-align:center;">
    <h1 style="color:#C9A96E;font-size:24px;margin:0;letter-spacing:3px;">LEBON GRACE</h1>
  </div>
  
  <!-- Status Banner -->
  <div style="background:${status.color};padding:20px 32px;text-align:center;">
    <h2 style="color:white;font-size:20px;margin:0;">${status.title}</h2>
  </div>
  
  <!-- Content -->
  <div style="padding:32px;">
    <p style="font-size:14px;color:#666;line-height:1.6;">Hello ${order.customer_name},</p>
    <p style="font-size:14px;color:#666;line-height:1.6;">${status.message}</p>
    
    <!-- Order Details -->
    <div style="background:#f9f9f9;border-radius:12px;padding:24px;margin:24px 0;">
      <h3 style="font-size:14px;color:#2D2D2D;margin:0 0 16px 0;">Order Details</h3>
      <p style="font-size:13px;color:#666;margin:4px 0;">Order: #${order.id.slice(0, 8)}</p>
      <p style="font-size:13px;color:#666;margin:4px 0;">Phone: ${order.customer_phone}</p>
      <p style="font-size:13px;color:#666;margin:4px 0;">Delivery: ${order.delivery_method === "pickup" ? "Pickup" : "Delivery"}</p>
    </div>

    <!-- Payment Summary -->
    <div style="background:#f9f9f9;border-radius:12px;padding:24px;margin:24px 0;">
      <h3 style="font-size:14px;color:#2D2D2D;margin:0 0 16px 0;">Payment Summary</h3>
      <table style="width:100%;font-size:13px;color:#666;">
        <tr><td>Subtotal</td><td style="text-align:right;">${formatPrice(subtotal)}</td></tr>
        <tr><td>Delivery</td><td style="text-align:right;">${shippingLabel}</td></tr>
        <tr><td style="font-weight:600;color:#2D2D2D;">Total paid</td><td style="text-align:right;font-weight:600;color:#2D2D2D;">${formatPrice(order.total)}</td></tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="https://shop.lebon-grace.com/track" style="display:inline-block;padding:14px 32px;background:#16A34A;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Track Your Order</a>
      <br/><br/>
      <a href="https://shop.lebon-grace.com" style="display:inline-block;padding:14px 32px;background:#2D2D2D;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Visit Store</a>
    </div>

    <!-- Support -->
    <p style="font-size:12px;color:#999;text-align:center;margin-top:24px;">
      Questions? Contact us at <a href="mailto:care@lebon-grace.com" style="color:#C9A96E;">care@lebon-grace.com</a> or WhatsApp us.
    </p>
  </div>
  
  <!-- Footer -->
  <div style="background:#2D2D2D;padding:24px 32px;text-align:center;">
    <p style="color:#C9A96E;font-size:14px;letter-spacing:2px;margin:0;">LEBON GRACE</p>
    <p style="color:#666;font-size:11px;margin:8px 0 0 0;">Sharjah Media City, Al Messaned, Al Bataeh, Sharjah, UAE</p>
    <p style="color:#666;font-size:11px;margin:4px 0 0 0;">© 2026 Lebon Grace. All rights reserved.</p>
  </div>
</div>
</body>
</html>`;
}

export async function sendOrderEmail(order: EmailOrder, action: string): Promise<boolean> {
  if (!order.customer_email) return false;

  // Sending nothing beats sending the wrong thing. An action with no template
  // used to inherit the "Order Confirmed!" body — see the note on TEMPLATES.
  if (!isEmailable(action)) {
    console.log(`[email] no template for "${action}" — deliberately sending nothing`);
    return false;
  }

  try {
    const result = await resend.emails.send({
      from: fromAddress(),
      to: [order.customer_email],
      subject: getEmailSubject(order, action),
      html: buildEmailHTML(order, action),
    });
    
    console.log(`Email sent: ${action} to ${order.customer_email}`, result);
    return true;
  } catch (error) {
    console.error(`Email failed: ${action}`, error);
    return false;
  }
}
