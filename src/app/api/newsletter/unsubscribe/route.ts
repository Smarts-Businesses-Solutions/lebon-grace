import { NextRequest, NextResponse } from "next/server";
import { subscribers } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";
import { isDeliverableEmail } from "@/lib/email-address";
import { readUnsubscribeToken } from "@/lib/unsubscribe-token";


/**
 * Newsletter opt-out.
 *
 * The privacy policy promised subscribers could unsubscribe before any such
 * path existed. This is that path.
 *
 * It answers the same way whether or not the address was on the list. Telling a
 * caller "that email was not subscribed" would turn this into a free
 * membership oracle for anyone wanting to test addresses against the list.
 */
export async function POST(request: NextRequest) {
  // ── RFC 8058 one-click ──
  // Gmail and Yahoo POST here themselves when the recipient presses the native
  // Unsubscribe button: no cookie, no session, no JSON body, just
  // `List-Unsubscribe=One-Click` form data. The address therefore has to come
  // from the signed token in the URL.
  //
  // Checked BEFORE the rate limit on purpose. The limiter is keyed by IP, and
  // these requests come from Google's infrastructure — one busy day would rate
  // limit real people out of unsubscribing, and a recipient who cannot
  // unsubscribe presses "report spam" instead.
  const token = request.nextUrl.searchParams.get("token");
  if (token) {
    const addr = readUnsubscribeToken(token);
    if (!addr) {
      return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
    }
    try {
      await subscribers.remove(addr);
    } catch (err) {
      console.error("[unsubscribe:one-click] failed to remove", err);
      // 200 anyway: a mail provider that sees an error may retry or, worse,
      // decide the header is unreliable. The failure is logged for us.
    }
    return NextResponse.json({ ok: true });
  }

  const limited = rateLimit(request, { key: "unsubscribe", limit: 10, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const { email } = body as Record<string, string>;

  if (!email || !isDeliverableEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  try {
    await subscribers.remove(email);
  } catch (err) {
    console.error("unsubscribe failed", err);
    return NextResponse.json({ error: "Could not process that. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
