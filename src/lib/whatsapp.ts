/**
 * WhatsApp notification utility for Lebon Grace.
 *
 * Supports two modes:
 * 1. Meta Cloud API (WhatsApp Business API) — requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID
 * 2. wa.me link fallback — generates pre-filled message links for manual sending
 *
 * Free tier: 1000 conversations/month via Meta Cloud API.
 */

interface WhatsAppOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  deposit_amount: number;
  cod_amount: number;
  status: string;
  delivery_method: string;
  tracking_number?: string;
  courier_name?: string;
}

function cleanPhone(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");
  // Ensure UAE country code
  if (cleaned.startsWith("0")) cleaned = "971" + cleaned.slice(1);
  if (!cleaned.startsWith("971")) cleaned = "971" + cleaned;
  return cleaned;
}

function formatPrice(amount: number): string {
  return `AED ${amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusMessage(order: WhatsAppOrder): string {
  switch (order.status) {
    case "confirmation":
      return `✅ Order Confirmed!\n\nHi ${order.customer_name}, your Lebon Grace order #${order.id.slice(0, 8)} has been confirmed.\n\n💰 Payment:\n• Paid now: ${formatPrice(order.deposit_amount)}\n• Pay on delivery: ${formatPrice(order.cod_amount)}\n\n📦 Delivery: ${order.delivery_method === "pickup" ? "Pickup" : "Delivery"}\n\nWe'll update you when your order ships!`;
    case "processing":
      return `📦 Order Update\n\nHi ${order.customer_name}, your order #${order.id.slice(0, 8)} is being prepared and will ship soon!`;
    case "shipped":
      return `🚚 Order Shipped!\n\nHi ${order.customer_name}, your order #${order.id.slice(0, 8)} is on its way!${order.tracking_number ? `\n\nTracking: ${order.tracking_number}` : ""}`;
    case "out_for_delivery":
      return `🛵 Arriving Today!\n\nHi ${order.customer_name}, your order #${order.id.slice(0, 8)} is out for delivery.${order.cod_amount > 0 ? `\n\n💵 Please have ${formatPrice(order.cod_amount)} ready for the courier.` : ""}`;
    case "delivered":
      return `✅ Delivered!\n\nHi ${order.customer_name}, your order #${order.id.slice(0, 8)} has been delivered. We hope you love it!\n\nThank you for shopping with Lebon Grace 💛`;
    case "cancelled":
      return `❌ Order Cancelled\n\nHi ${order.customer_name}, your order #${order.id.slice(0, 8)} has been cancelled. As a reminder, all sales are final. If you believe this was an error, please contact us.`;
    default:
      return `📋 Order Update\n\nHi ${order.customer_name}, your order #${order.id.slice(0, 8)} has been updated. Status: ${order.status}`;
  }
}

/**
 * Generate a wa.me link for manual WhatsApp messaging.
 * Returns the URL that opens WhatsApp with a pre-filled message.
 */
export function generateWhatsAppLink(order: WhatsAppOrder): string {
  const phone = cleanPhone(order.customer_phone);
  const message = getStatusMessage(order);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Send WhatsApp message via Meta Cloud API.
 * Requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendWhatsAppMessage(order: WhatsAppOrder): Promise<boolean> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.warn("WhatsApp API not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
    return false;
  }

  const phone = cleanPhone(order.customer_phone);
  const message = getStatusMessage(order);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("WhatsApp API error:", error);
      return false;
    }

    const result = await response.json();
    console.log("WhatsApp sent:", result.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error("WhatsApp send failed:", error);
    return false;
  }
}

/**
 * Send notification via WhatsApp if API is configured,
 * otherwise log the wa.me link for manual sending.
 */
export async function notifyWhatsApp(order: WhatsAppOrder): Promise<{ sent: boolean; link: string }> {
  const link = generateWhatsAppLink(order);

  const sent = await sendWhatsAppMessage(order);
  if (!sent) {
    console.log(`WhatsApp fallback — manual link: ${link}`);
  }

  return { sent, link };
}
