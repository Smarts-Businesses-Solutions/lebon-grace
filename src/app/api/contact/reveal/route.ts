import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { CONTACT, whatsappUrl } from "@/lib/contact";

/**
 * Hands over the phone number and email only when a visitor asks for them.
 *
 * Keeping these out of the served HTML and out of the JS bundle is what stops
 * the cheap harvesting: crawlers that regex over page source, and mailto:
 * scrapers, never execute this. A determined scraper can call the endpoint, so
 * it is rate limited to make bulk collection slow and obvious rather than free.
 *
 * noindex is set so the response never lands in a search index.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { key: "contact-reveal", limit: 20, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  return NextResponse.json(
    {
      phone: CONTACT.phoneDisplay,
      email: CONTACT.email,
      whatsapp: whatsappUrl("Hi, I have a question about Lebon Grace."),
    },
    { headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" } }
  );
}
