import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { rateLimit } from "@/lib/rate-limit";
import { CONTACT } from "@/lib/contact";
import { fromAddress } from "@/lib/email";
import { isDeliverableEmail } from "@/lib/email-address";

const resend = new Resend(process.env.RESEND_API_KEY);


function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

/**
 * Contact form.
 *
 * The previous form did not exist server-side at all: the page ran a setTimeout
 * and told the customer their message had been sent. Everything anyone wrote
 * was discarded.
 */
export async function POST(request: NextRequest) {
  // Sends mail on demand, so it is abusable. Three an hour per IP is generous
  // for a real customer and useless to a spammer.
  const limited = rateLimit(request, { key: "contact", limit: 3, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const { name, email, subject, message, website } = body as Record<string, string>;

  // Honeypot: a field hidden from people and irresistible to bots. Anything
  // that fills it gets a cheerful 200 and no email, so the bot does not learn
  // it was caught and retry differently.
  if (website) return NextResponse.json({ success: true });

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email and message are required" }, { status: 400 });
  }
  if (!isDeliverableEmail(email)) {
    return NextResponse.json({ error: "That email address does not look right" }, { status: 400 });
  }
  if (message.length > 4000 || name.length > 100) {
    return NextResponse.json({ error: "That message is too long" }, { status: 400 });
  }

  const html = `
    <p><strong>From:</strong> ${esc(name)} (${esc(email)})</p>
    <p><strong>Subject:</strong> ${esc(subject || "No subject")}</p>
    <hr />
    <p style="white-space:pre-wrap">${esc(message)}</p>
  `;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: [CONTACT.email],
      replyTo: email,
      subject: `Website enquiry: ${subject || "No subject"}`,
      html,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact form send failed:", err);
    // Do not claim success on failure. The customer needs to know to try again.
    return NextResponse.json({ error: "Could not send your message. Please try again." }, { status: 500 });
  }
}
