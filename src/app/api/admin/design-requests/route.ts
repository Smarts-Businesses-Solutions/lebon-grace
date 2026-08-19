import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  listOpenRequests,
  setStatus,
  clearArtwork,
  getByReference,
  type DesignRequestStatus,
} from "@/lib/design-requests";
import { deleteArtwork } from "@/lib/artwork-storage";

/**
 * The operator's queue of custom design conversations.
 *
 * ADMIN ONLY, and for a sharper reason than most admin routes: every row here
 * carries a customer's name, email, phone number and a pointer to a photograph
 * they sent, frequently of a child. This is the highest-sensitivity list the
 * shop holds.
 *
 * The artwork itself is NOT returned. A signed URL is minted separately by
 * /api/admin/design-requests/artwork, per request, and lives for sixty seconds.
 * Embedding a long-lived link in a list response would put a working key to
 * someone's photograph into browser history, logs and any screenshot of the
 * queue.
 */

export const dynamic = "force-dynamic";

/** Everything still needing a human, oldest first. */
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await listOpenRequests();

  return NextResponse.json(
    {
      requests: rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        createdAt: r.created_at,
        name: r.customer_name,
        email: r.customer_email,
        phone: r.customer_phone,
        brief: r.brief,
        status: r.status,
        // Whether artwork exists, never where it is. The key is an internal
        // detail and the viewer route looks it up server side from the id.
        hasArtwork: Boolean(r.artwork_key),
        artworkBytes: r.artwork_bytes,
        note: r.operator_note,
      })),
    },
    // A queue of customer contact details has no business in any cache.
    { headers: { "Cache-Control": "no-store" } },
  );
}

const ALLOWED: DesignRequestStatus[] = ["discussing", "approved", "declined"];

/**
 * Move a request along, or decline it.
 *
 * DECLINING DELETES THE ARTWORK IMMEDIATELY rather than waiting for the 90 day
 * sweep. If we are not making the piece there is no reason to keep a customer's
 * photograph, and "we will delete it eventually" is a worse answer than "it is
 * gone" when the customer is a parent asking.
 */
export async function PATCH(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    reference?: string;
    status?: DesignRequestStatus;
    note?: string;
  };

  if (!body.reference || !body.status) {
    return NextResponse.json({ error: "reference and status are required" }, { status: 400 });
  }

  if (!ALLOWED.includes(body.status)) {
    // "ordered" is set by the order path, not by hand; "expired" by the sweep;
    // "submitted" is where a row starts. Letting the operator write those from
    // here would make the status mean whatever was last clicked.
    return NextResponse.json(
      { error: `status must be one of ${ALLOWED.join(", ")}` },
      { status: 400 },
    );
  }

  const row = await getByReference(body.reference);
  if (!row) return NextResponse.json({ error: "No such request" }, { status: 404 });

  if (body.status === "declined" && row.artwork_key) {
    /*
     * Storage first, then the row.
     *
     * If the delete fails we have not yet told the database the artwork is
     * gone, so the row still points at a real object and the sweep will try
     * again. The other order would leave an orphan in R2 that nothing knows
     * about, which is how a private bucket quietly accumulates photographs
     * nobody can account for.
     */
    await deleteArtwork(row.artwork_key);
    await clearArtwork(row.id, "declined");
    if (body.note !== undefined) await setStatus(row.id, "declined", body.note);
    return NextResponse.json({ success: true, artworkDeleted: true });
  }

  await setStatus(row.id, body.status, body.note);
  return NextResponse.json({ success: true });
}
