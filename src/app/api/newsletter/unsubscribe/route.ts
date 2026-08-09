import { NextRequest, NextResponse } from "next/server";
import { subscribers } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";
import { isDeliverableEmail } from "@/lib/email-address";


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
