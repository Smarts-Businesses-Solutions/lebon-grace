import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getByReference } from "@/lib/design-requests";
import { signedArtworkUrl } from "@/lib/artwork-storage";

/**
 * Hand the operator a way to look at one customer's artwork, briefly.
 *
 * This is the ONLY path from the outside world to the private bucket, and it
 * exists as its own route rather than a field on the queue listing for one
 * reason: a signed URL is a bearer credential. Anyone holding it can fetch the
 * photograph without a session. Putting one in a list response would mint a
 * working key for every open request at once, and leave them in browser
 * history, server logs and any screenshot of the queue.
 *
 * So: one request, one URL, sixty seconds, and only for the row actually asked
 * for. The operator's browser follows it immediately; nothing else needs to.
 *
 * The route takes a REFERENCE, not an object key. The key is looked up server
 * side, so a caller cannot ask for an arbitrary path in the bucket even with a
 * valid session.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reference = request.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "reference is required" }, { status: 400 });
  }

  const row = await getByReference(reference);
  if (!row) return NextResponse.json({ error: "No such request" }, { status: 404 });

  if (!row.artwork_key) {
    // Either the upload was rejected, or the sweep has already taken it. Both
    // are ordinary states, not errors.
    return NextResponse.json({ error: "This request has no artwork" }, { status: 404 });
  }

  const url = await signedArtworkUrl(row.artwork_key, 60);

  return NextResponse.json(
    { url, expiresInSeconds: 60, contentType: row.artwork_type },
    {
      headers: {
        // The response body IS the credential. It must not be cached anywhere,
        // by anything, for any length of time.
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        // If a signed URL ever leaks through a referrer it stops being
        // short-lived and starts being published.
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}
