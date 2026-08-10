import { NextRequest, NextResponse } from "next/server";
import { subscribers } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";
import { getAppUrl } from "@/lib/app-url";

/**
 * The other half of double opt-in (NS-01).
 *
 * Opened from an inbox by clicking a link, so it is a **GET** that redirects to
 * a human-readable page — not JSON. Nobody opens a mail client expecting
 * `{"success":true}`.
 *
 * A GET that changes state is normally a smell, and it is worth saying why it is
 * right here: the alternative is asking someone to POST from an e-mail, which
 * means a form and a second click, and the whole point is that confirming should
 * be easier than ignoring. The token is single-use and burned on confirmation,
 * so a prefetching mail client can confirm the subscription — which is what the
 * recipient wanted — but cannot do anything else, and cannot repeat it.
 */
export async function GET(request: NextRequest) {
  // Someone with a stolen token list would otherwise be able to grind through
  // it. A real subscriber clicks once.
  const limited = rateLimit(request, { key: "newsletter-confirm", limit: 10, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const token = new URL(request.url).searchParams.get("token") || "";

  let confirmed = false;
  try {
    confirmed = await subscribers.confirm(token);
  } catch (err) {
    console.error("[newsletter-confirm] could not confirm:", err);
    return NextResponse.redirect(`${getAppUrl()}/?newsletter=error`, 303);
  }

  /*
   * An unknown token and an already-used one are answered identically.
   *
   * They are indistinguishable to an attacker on purpose — otherwise this
   * becomes an oracle for which tokens once existed. For the genuine subscriber
   * who clicked twice, "already confirmed" and "confirmed" mean the same thing
   * in practice, so nothing is lost by conflating them.
   *
   * 303 rather than 302 so the browser is required to follow with GET.
   */
  return NextResponse.redirect(
    `${getAppUrl()}/?newsletter=${confirmed ? "confirmed" : "invalid"}`,
    303
  );
}
