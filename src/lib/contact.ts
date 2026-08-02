/**
 * Contact details, server-side only.
 *
 * Nothing here is imported by a client component, so none of it is inlined into
 * the JavaScript bundle. The browser gets these values only by calling
 * /api/contact/reveal, which is rate limited.
 *
 * What this does and does not achieve, honestly: any channel a customer can use
 * a scraper can eventually use too. The point is to defeat the cheap attacks,
 * which are the overwhelming majority: regex over static HTML, mailto: harvesters,
 * and crawlers that never execute JavaScript. It does not stop someone who
 * decides to target this shop specifically.
 *
 * Previous approach was base64 in a client component. That is not protection:
 * the plain value sat in the bundle next to the encoded one, and base64 is a
 * decode, not a cipher.
 */

export const CONTACT = {
  /** Digits only, for wa.me links. */
  whatsapp: process.env.CONTACT_WHATSAPP || "971588286630",
  /** Formatted for display. */
  phoneDisplay: process.env.CONTACT_PHONE_DISPLAY || "+971 58 828 6630",
  email: process.env.CONTACT_EMAIL || "care@lebon-grace.com",
} as const;

export function whatsappUrl(message?: string): string {
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${CONTACT.whatsapp}${text}`;
}
