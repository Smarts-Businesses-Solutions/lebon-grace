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
 *
 * THE PHONE NUMBER HAS NO DEFAULT, AND THAT IS THE POINT.
 *
 * It used to be a literal here. This repository is PUBLIC on GitHub, so that
 * literal was in indexed, searchable source, and GitHub code search is itself a
 * harvesting channel. Keeping the number out of the served HTML while committing
 * it to a public repo protects nothing. It now comes from the environment only:
 * .env.local locally, and the application's environment on Coolify in production.
 *
 * When it is unset the site does not break. Phone and WhatsApp are simply not
 * offered, and email still is. A missing number should degrade the contact
 * options, not take down a shop.
 */

export const CONTACT = {
  /** Digits only, for wa.me links. Null when unconfigured. */
  whatsapp: process.env.CONTACT_WHATSAPP || null,
  /** Formatted for display. Null when unconfigured. */
  phoneDisplay: process.env.CONTACT_PHONE_DISPLAY || null,
  /**
   * Kept defaulted, unlike the phone. It is load-bearing for the
   * List-Unsubscribe header and for operator notifications, both of which must
   * work in any environment, and it is already published on every page footer,
   * so withholding it here would buy nothing.
   */
  email: process.env.CONTACT_EMAIL || "care@lebon-grace.com",
} as const;

/** Null when no number is configured, so callers must decide what to render. */
export function whatsappUrl(message?: string): string | null {
  if (!CONTACT.whatsapp) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${CONTACT.whatsapp}${text}`;
}
