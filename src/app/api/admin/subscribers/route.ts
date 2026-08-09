import { NextRequest, NextResponse } from "next/server";
import { subscribers } from "@/lib/store";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * The newsletter list, for the operator.
 *
 * Until this existed, an address typed into the homepage went into a table that
 * nothing in the application could read: `subscribers` had `add` and `remove`
 * and no way to see what was in it. The homepage promises "We will email you
 * when there is something new" — a promise the shop had no mechanism to keep,
 * because the operator could not reach the list at all without opening the
 * database by hand.
 *
 * ADMIN ONLY, and for the same reason `/api/orders`' unfiltered branch is: this
 * returns a list of people's email addresses. It is the kind of endpoint that
 * gets added "just to check something" and then sits there public — which is
 * exactly what happened to `/api/variants` (FOR-EVARISTE: a new file under
 * src/app/api/ is public on creation).
 *
 * `?format=csv` because the realistic next step is pasting these into whatever
 * actually sends the mail; there is no sending path in this application, and
 * inventing one is not this endpoint's job.
 */
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await subscribers.getAll();

  if (new URL(request.url).searchParams.get("format") === "csv") {
    // Quote every field and double any embedded quote. An address cannot
    // normally contain a comma, but "cannot normally" is how CSV injection
    // starts, and the source column is written by us rather than validated.
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      "email,source,subscribed_at",
      ...list.map((s) => [esc(s.email), esc(s.source ?? ""), esc(s.created_at)].join(",")),
    ].join("\n");
    return new NextResponse(rows, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="subscribers.csv"',
      },
    });
  }

  return NextResponse.json({ count: list.length, subscribers: list });
}
