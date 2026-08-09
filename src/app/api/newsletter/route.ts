import { NextRequest, NextResponse } from "next/server";
import { subscribers } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";
import { isDeliverableEmail } from "@/lib/email-address";


/**
 * Newsletter signup.
 *
 * The previous version of this had no server side at all. The homepage ran
 * `setSubscribed(true)` and showed "You're subscribed! Check your inbox for a
 * welcome offer." Nothing was stored, nothing was sent, and there was no
 * welcome offer. Every address anyone typed was dropped on the floor.
 *
 * This stores the address so the list actually exists. It deliberately does not
 * send a welcome mail, because there is no welcome offer to send yet.
 */
export async function POST(request: NextRequest) {
  // Writes a row per call, so it needs a ceiling. Five an hour per IP is far
  // more than a person subscribing once will ever need.
  const limited = rateLimit(request, { key: "newsletter", limit: 5, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const { email, website } = body as Record<string, string>;

  // Honeypot, same as the contact form: hidden from people, filled by bots.
  // A bot gets a 200 and no row, so it does not learn to try again differently.
  if (website) return NextResponse.json({ success: true });

  if (!email || !isDeliverableEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  try {
    await subscribers.add(email, "homepage");
  } catch (err) {
    console.error("newsletter signup failed", err);
    return NextResponse.json({ error: "Could not save your address. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
