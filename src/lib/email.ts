import { Resend } from "resend";
import { getAppUrl } from "./app-url";
import { CONTACT } from "./contact";
import { operatorEmails } from "./admin-auth";
import { makeUnsubscribeToken } from "./unsubscribe-token";
import { generateWhatsAppLink } from "./whatsapp";

/**
 * Escape for interpolation into an HTML email body.
 *
 * Exported rather than kept local: /api/contact had its own identical copy, and
 * duplicated escaping is exactly the thing that ends up fixed in one place and
 * not the other.
 */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

let _resend: Resend | null = null;

/**
 * The mail client, constructed on first use rather than at module load.
 *
 * `const resend = new Resend(process.env.RESEND_API_KEY)` at module scope threw
 * `Missing API key` the moment this file was IMPORTED with no key present. Next
 * evaluates every route module during `next build` to collect its config, so
 * that turned an absent environment variable into a failed BUILD rather than a
 * failed send — and made the build depend on production secrets.
 *
 * It survived because the only build that ran was the Docker one, and
 * build-apps.sh passes placeholders. The Forgejo CI gate built without them on
 * its first real run and died on /api/contact and /api/cart-recovery. The
 * project had even written the trap down (FOR-EVARISTE: "builds need placeholder
 * env values") — this removes the need for that advice rather than repeating it,
 * because a workaround that must be remembered in every new build context is
 * forgotten in each one until something breaks.
 *
 * Deliberately no "key is missing" guard of its own: `email.test.ts` mocks the
 * `resend` module and sets no key, so a guard here would fail those tests. The
 * SDK's own error is enough, and it now surfaces at send time — inside the
 * try/catch each caller already has — instead of at import.
 *
 * Matches the lazy `db()` in store.ts and login-throttle.ts. Resend was the
 * outlier, not the pattern.
 */
export function mailer(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

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
 * fallback.
 *
 * **The default does NOT work on the provider actually in use.** This comment
 * used to claim lebon-grace.com "is a verified SES identity with DKIM — so it
 * works on either provider". It may well be verified on SES; the app sends
 * through **Resend**, where it is not, and every send has come back
 *   403 The lebon-grace.com domain is not verified
 * That went unnoticed for months because the send path reported success
 * regardless (see `deliver`). Verified on 2026-08-10 by POSTing to the Resend
 * API from the production container.
 *
 * To fix delivery, either verify lebon-grace.com at https://resend.com/domains
 * or point MAIL_FROM_ADDRESS at a domain already verified on that account.
 * Until one of those is done the shop sends no e-mail at all — the code change
 * only makes the failure audible.
 */
export function fromAddress(): string {
  return (
    process.env.MAIL_FROM_ADDRESS ||
    process.env.RESEND_FROM_ADDRESS ||
    "Lebon Grace <orders@lebon-grace.com>"
  );
}

/**
 * Send, and actually find out whether it was sent.
 *
 * **Resend does not throw when it rejects a send.** Its own type is
 * `{data: T, error: null} | {error: ErrorResponse, data: null}`, so
 * `await mailer().emails.send(...)` resolves normally for a 403, a bad
 * address, an unverified domain — every API-level refusal. A `try/catch`
 * around it catches only network failures, which is why all three send paths
 * in this file used to `return true` unconditionally.
 *
 * That was not a theoretical hole. Production ran with an unverified sending
 * domain, so every e-mail the shop ever attempted came back
 * `403 The lebon-grace.com domain is not verified` — order confirmations,
 * status updates, operator alerts, all of it — and every one was reported as
 * delivered. Same shape as B-29: the mechanism produced no output, and no
 * output looked exactly like success.
 *
 * Returns false rather than throwing, because every caller is fire-and-forget
 * inside a Stripe webhook.
 *
 * **Exported**, because B-30's first fix routed only the three senders in this
 * file through it and left /api/contact and /api/cart-recovery calling the SDK
 * directly — so those two kept reporting refusals as successes. Any new sender
 * goes through here; nothing should call `mailer().emails.send` itself.
 */
/**
 * RFC 8058 one-click unsubscribe headers, for MARKETING mail only.
 *
 * Deliberately not applied to order confirmations or operator alerts: you
 * cannot unsubscribe from a receipt, and offering it on transactional mail
 * teaches recipients that the button does nothing.
 *
 * Both headers are required together. `List-Unsubscribe` alone is the old
 * mailto/HTTP convention; adding `List-Unsubscribe-Post` is what tells Gmail
 * and Yahoo the URL will honour a bare POST, which is what makes the native
 * "Unsubscribe" button appear beside the sender name. Without it the recipient
 * reaches for "report spam" instead, and complaints are what actually damage a
 * sending domain.
 *
 * Returns nothing when no token can be made (no secret configured), rather
 * than a broken link — a header pointing at a URL that cannot work is worse
 * than no header.
 */
export function unsubscribeHeaders(recipient: string): Record<string, string> {
  const token = makeUnsubscribeToken(recipient);
  if (!token) return {};
  const url = `${getAppUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    "List-Unsubscribe": `<${url}>, <mailto:${CONTACT.email}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function deliver(label: string, payload: Parameters<Resend["emails"]["send"]>[0]): Promise<boolean> {
  try {
    const { error } = await mailer().emails.send(payload);
    if (error) {
      // The message names the cause ("domain is not verified", "Invalid `to`"),
      // which is the difference between a fixable log line and a mystery.
      console.error(`[${label}] Resend REFUSED the send: ${error.message} (${error.name}, ${error.statusCode})`);
      return false;
    }
    return true;
  } catch (error) {
    // Network-level only — DNS, TLS, timeout.
    console.error(`[${label}] could not reach Resend:`, error);
    return false;
  }
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
    subject: (id) => `Order Confirmed #${id} | Lebon Grace`,
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
    // No "have cash ready" line. cod_amount is always 0 since Stripe began
    // collecting the full amount, so the branch was dead — but if it ever fired
    // it would ask a customer who has already paid to hand money to a courier.
    message: () => "Your order is out for delivery.",
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
    subject: (id) => `Order #${id} cancelled | Lebon Grace`,
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
    subject: (id) => `Refund issued for order #${id} | Lebon Grace`,
    title: "Refund Issued",
    color: "#6B7280",
    message: (o) =>
      `We have refunded ${formatPrice(o.total)} for this order. Refunds usually reach your account within 5-10 working days, depending on your bank. If it has not arrived by then, reply to this email and we will chase it.`,
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

  // Was: log `result` under the words "Email sent" and return true. `result`
  // is exactly where the rejection lives, so the log printed the failure while
  // claiming delivery.
  return deliver(`order-email:${action}`, {
    from: fromAddress(),
    to: [order.customer_email],
    subject: getEmailSubject(order, action),
    html: buildEmailHTML(order, action),
  });
}

/**
 * Tell the operator an order arrived.
 *
 * Nothing did. `sendOrderEmail` addresses `order.customer_email` and
 * `notifyWhatsApp` addresses the customer's phone — both go to the CUSTOMER,
 * and there was no admin recipient anywhere in the codebase. The maker found
 * out by opening /admin and looking. `.env.example` has documented
 * ORDER_NOTIFY_EMAIL since the beginning and no code ever read it.
 *
 * Same family as B-7 and B-18: the money path succeeds and the person who has
 * to act is the one nobody told.
 *
 * Email rather than WhatsApp, for now. The council split on this — MiniMax
 * argued WhatsApp is the right channel for a maker at a workbench with busy
 * hands, and it is probably right — but the WhatsApp Business credentials are
 * not configured in production, so that path silently returns false today.
 * Email works, is already proven to deliver to this address, and costs nothing.
 * Wiring WhatsApp later does not require changing this.
 *
 * Recipient: ORDER_NOTIFY_EMAIL if set (the documented variable), otherwise the
 * contact address, which is set in production and known to deliver. Honours the
 * intent without requiring configuration to start working.
 *
 * Content is chosen so the operator can act WITHOUT opening the admin page, and
 * the subject line carries the order and the value so it is useful unread on a
 * lock screen. The engraving is called out first: it is cut irreversibly, and
 * it is the one field worth checking before any wood is touched.
 */
export interface OperatorAlertItem {
  product_name: string;
  quantity: number;
  personalisation?: string | null;
}

/**
 * Tell the operator that something happened, in one line at the call site.
 *
 * Two events on this platform reached nobody. A **refund** moved the order and
 * emailed the customer, while the person whose money had just gone back — and
 * who might be about to cut the piece — was told nothing. And a **paid order
 * with no line items** (B-18) was a `console.error`, which did not reach
 * GlitchTip at all, because `captureConsoleIntegration` was never configured.
 * "Loud" meant silent.
 *
 * Deliberately generic rather than another bespoke template: the next such
 * event should cost one line, not a new mail-shaped thing to keep in step with
 * the others. That drift is what made B-5 possible.
 *
 * Never throws. Every caller is fire-and-forget inside a Stripe webhook, where
 * throwing would fail the webhook, Stripe would retry, and the idempotency
 * check would then skip the real work — so the notice would be lost *and* the
 * order mishandled.
 */
/**
 * Everyone who should hear about shop operations.
 *
 * Was a single address, so with two operators one of them learned about a new
 * order and the other did not — decided by an environment variable nobody
 * looks at. Now: every operator who can sign in, PLUS the shared mailbox, which
 * may be watched by someone who never opens /admin.
 *
 * Case-insensitive dedupe, because an operator being the notify address too is
 * the normal case, not an edge case.
 */
function operatorRecipients(): string[] {
  const mailbox = process.env.ORDER_NOTIFY_EMAIL || CONTACT.email;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...operatorEmails(), mailbox]) {
    const addr = (raw || "").trim();
    const key = addr.toLowerCase();
    if (!addr || seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

export async function sendOperatorNotice(subject: string, bodyHtml: string): Promise<boolean> {
  const to = operatorRecipients();
  if (!to.length) {
    console.error("[operator-notice] no operators and no ORDER_NOTIFY_EMAIL — nobody will be told");
    return false;
  }
  return deliver("operator-notice", {
    from: fromAddress(),
    to,
    subject,
    html: bodyHtml,
  });
}

export async function sendOperatorOrderAlert(
  order: EmailOrder & { delivery_method?: string; customer_phone?: string },
  items: OperatorAlertItem[] = []
): Promise<boolean> {
  const to = operatorRecipients();
  if (!to.length) {
    console.error("[operator-alert] no operators and no ORDER_NOTIFY_EMAIL — nobody will be told about orders");
    return false;
  }

  const short = String(order.id || "").slice(0, 8);
  const engraved = items.filter((i) => i.personalisation);
  const lines = items.length
    ? items
        .map(
          (i) =>
            `<li>${i.quantity} x ${esc(i.product_name)}${
              i.personalisation ? `, <strong>engrave: ${esc(String(i.personalisation))}</strong>` : ""
            }</li>`
        )
        .join("")
    : "<li><strong>No line items recorded</strong>, check the Stripe session before cutting anything.</li>";

  /*
   * A way to actually reach the customer.
   *
   * WhatsApp is this shop's normal channel, but customer WhatsApp messages do
   * not send: WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are unset, and
   * getting them needs a Meta Business account. `notifyWhatsApp()` already
   * copes by returning a manual wa.me link — and then console.log-ing it, while
   * both callers discard the return value. So the link went to a server console
   * nobody reads: the customer got no message and the operator was never told.
   * That is B-20's shape, in the alert written to fix B-20.
   *
   * The link is built here rather than passed in, because generateWhatsAppLink
   * is pure — no env, no await — so this needs no change to the fire-and-forget
   * timing at either call site.
   *
   * The "not configured" line is driven by the environment, so it stops nagging
   * the day the credentials are added instead of becoming furniture.
   */
  const waConfigured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  );
  const waLink = order.customer_phone
    ? generateWhatsAppLink({
        id: String(order.id),
        customer_name: order.customer_name || "Customer",
        customer_phone: order.customer_phone,
        status: "confirmation",
        deposit_amount: order.deposit_amount,
        cod_amount: order.cod_amount,
        delivery_method: order.delivery_method === "pickup" ? "pickup" : "delivery",
        total: order.total,
      })
    : null;

  const html = `
    <p><strong>New order #${esc(short)}</strong>, AED ${order.total}</p>
    <ul>${lines}</ul>
    <p>${esc(order.customer_name || "")}${order.customer_phone ? ` · ${esc(order.customer_phone)}` : ""}</p>
    <p>${order.delivery_method === "delivery" ? "Delivery" : "Collection"} · made to order, 2 to 3 working days</p>
    ${engraved.length ? "<p><strong>Check the spelling before cutting.</strong></p>" : ""}
    ${
      waLink
        ? `<p><a href="${waLink}" style="display:inline-block;padding:10px 18px;background:#25D366;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Message ${esc(
            order.customer_name || "the customer"
          )} on WhatsApp</a></p>` +
          (waConfigured
            ? ""
            : `<p style="font-size:12px;color:#666;">Automatic WhatsApp is <strong>not configured</strong>, so nothing was sent to the customer. Message them yourself with the button above. To turn it on, set <code>WHATSAPP_ACCESS_TOKEN</code> and <code>WHATSAPP_PHONE_NUMBER_ID</code>.</p>`)
        : `<p style="font-size:12px;color:#666;">No phone number on this order, so there is no WhatsApp link.</p>`
    }
  `;

  // Loud, not thrown. The caller must not fail the webhook over this — see the
  // note at the call site about Stripe retries and idempotency. `deliver`
  // keeps that contract and additionally notices a refusal, which the old
  // try/catch could not: a 403 resolves, so this returned true while the
  // operator was told nothing.
  return deliver(`operator-alert:${short}`, {
    from: fromAddress(),
    to,
    subject: `New order #${short}, AED ${order.total}${engraved.length ? " (engraved)" : ""}`,
    html,
  });
}
