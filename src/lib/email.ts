import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
  items?: Array<{ name: string; price: number; quantity: number; image?: string }>;
  tracking_number?: string;
}

function formatPrice(amount: number): string {
  return `AED ${amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getEmailSubject(order: EmailOrder, action: string): string {
  const id = order.id.slice(0, 8);
  switch (action) {
    case "confirmation": return `Order Confirmed #${id} — Lebon Grace`;
    case "processing": return `Order Update: Your order #${id} is being prepared`;
    case "shipped": return `Your order #${id} has shipped! 🚚`;
    case "out_for_delivery": return `Your order #${id} arrives today!`;
    case "delivered": return `Thank you! Your order #${id} is delivered ✅`;
    case "cancelled": return `Order #${id} cancelled — Lebon Grace`;
    default: return `Order Update #${id} — Lebon Grace`;
  }
}

function buildEmailHTML(order: EmailOrder, action: string): string {
  const itemsList = (order.items || []).map(item =>
    `<tr><td style="padding:12px 0;border-bottom:1px solid #eee;">${item.name}</td><td style="padding:12px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td><td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.price * item.quantity)}</td></tr>`
  ).join("");

  const statusMap: Record<string, { title: string; message: string; color: string }> = {
    confirmation: {
      title: "Order Confirmed!",
      message: "Thank you for your order. We're preparing your items now.",
      color: "#16A34A",
    },
    processing: {
      title: "Order Being Prepared",
      message: "Your order is being prepared and will ship soon.",
      color: "#2563EB",
    },
    shipped: {
      title: "Your Order Has Shipped!",
      message: order.tracking_number
        ? `Your order is on its way! Tracking: ${order.tracking_number}`
        : "Your order is on its way! We'll send tracking details soon.",
      color: "#7C3AED",
    },
    out_for_delivery: {
      title: "Arriving Today!",
      message: `Your order is out for delivery. ${
        order.cod_amount > 0
          ? `Please have ${formatPrice(order.cod_amount)} ready for the courier.`
          : ""
      }`,
      color: "#EA580C",
    },
    delivered: {
      title: "Order Delivered!",
      message: "Your order has been delivered. We hope you love it!",
      color: "#16A34A",
    },
    cancelled: {
      title: "Order Cancelled",
      message: "Your order has been cancelled. As a reminder, all sales are final and we do not offer refunds. If you believe this was an error, please contact our support team.",
      color: "#DC2626",
    },
  };

  const status = statusMap[action] || statusMap.confirmation;

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
        <tr><td>Subtotal</td><td style="text-align:right;">${formatPrice(order.total)}</td></tr>
        <tr><td>Shipping</td><td style="text-align:right;">${order.delivery_method === "pickup" ? "Free (Pickup)" : order.total > 300 ? "Free" : formatPrice(25)}</td></tr>
        <tr><td style="font-weight:600;color:#2D2D2D;">Total</td><td style="text-align:right;font-weight:600;color:#2D2D2D;">${formatPrice(order.total)}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #eee;margin:12px 0;" />
      <table style="width:100%;font-size:13px;">
        <tr><td style="color:#16A34A;">✓ Paid now (card)</td><td style="text-align:right;color:#16A34A;font-weight:600;">${formatPrice(order.deposit_amount)}</td></tr>
        <tr><td style="color:#C9A96E;">● Pay on delivery (COD)</td><td style="text-align:right;color:#C9A96E;font-weight:600;">${formatPrice(order.cod_amount)}</td></tr>
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
  
  try {
    const result = await resend.emails.send({
      from: "Lebon Grace <onboarding@resend.dev>",
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
