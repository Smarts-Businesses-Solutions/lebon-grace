"use client";

import { useState, useEffect, useCallback } from "react";
import { OPERATOR_SETTABLE_STATUSES } from "@/lib/design-requests";

/**
 * The operator's side of the custom design conversation.
 *
 * A customer sends a photograph and a brief; someone has to look at it, talk to
 * them, and say yes or no. This is where that happens. It is the only place in
 * the admin that shows a customer's photograph, and the rules below are what
 * keep that from becoming a leak.
 *
 * THE SIGNED URL IS A BEARER CREDENTIAL. Anyone holding it can fetch the
 * photograph with no session at all. So it is fetched one row at a time, only
 * when the operator asks, and it is rendered into an <img> rather than opened
 * in a tab: a navigation writes the URL into browser history, where it outlives
 * its sixty seconds as a readable string. An image load does not. Closing the
 * viewer drops the URL from state so a later render cannot resurrect it.
 *
 * DECLINING DELETES THE PHOTOGRAPH. That is the point of declining rather than
 * ignoring, so it is confirmed rather than one click away.
 */

interface DesignRequest {
  id: string;
  reference: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string | null;
  brief: string;
  status: string;
  hasArtwork: boolean;
  artworkBytes: number | null;
  note: string | null;
}

/*
 * The three statuses an operator sets by hand, in the order the conversation
 * goes. The list itself comes from design-requests.ts, which the API route
 * validates against, so a button here cannot offer something the server 400s.
 */
const HINTS: Record<string, { label: string; hint: string }> = {
  discussing: { label: "Discussing", hint: "You have replied and are agreeing the design" },
  approved: { label: "Approved", hint: "The design is final and may be cut" },
  declined: { label: "Decline", hint: "Deletes the photograph immediately" },
};

const ACTIONS = OPERATOR_SETTABLE_STATUSES.map((status) => ({ status, ...HINTS[status] }));

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-yellow-50 text-yellow-700",
  discussing: "bg-blue-50 text-blue-700",
  approved: "bg-green-50 text-green-700",
  ordered: "bg-emerald-50 text-emerald-700",
  declined: "bg-stone-100 text-stone-600",
  expired: "bg-paper text-ink-soft",
};

const kb = (bytes: number | null) => (bytes ? `${Math.round(bytes / 1024)} KB` : "");

/**
 * One request, as a card.
 *
 * Split out and exported with no hooks of its own so a test can render it to
 * static markup and assert on what reaches the page — the project has no jsdom,
 * and the properties worth pinning here (that a signed URL becomes an <img> and
 * never an href, that the key never appears) are markup properties. Same shape
 * as CuttingQueue in OperationsDashboard.
 */
export function RequestCard({
  request: r,
  note,
  busy,
  viewingUrl,
  onNote,
  onView,
  onMove,
  onCloseViewer,
}: {
  request: DesignRequest;
  note: string;
  busy: boolean;
  /** Set only while this row's artwork is on screen. */
  viewingUrl: string | null;
  onNote: (value: string) => void;
  onView: () => void;
  onMove: (status: string) => void;
  onCloseViewer: () => void;
}) {
  return (
    <article className="rounded-xl border border-rule bg-bone p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-semibold text-ink">{r.reference}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                STATUS_STYLE[r.status] ?? "bg-paper text-ink-soft"
              }`}
            >
              {r.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {r.name} ·{" "}
            {new Date(r.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <a href={`mailto:${r.email}`} className="text-ink underline underline-offset-2">
            {r.email}
          </a>
          {r.phone && (
            <a
              href={`https://wa.me/${r.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline underline-offset-2"
            >
              WhatsApp
            </a>
          )}
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap rounded-lg bg-paper p-3 text-sm text-ink">{r.brief}</p>

      {r.note && (
        <p className="mt-2 text-sm text-ink-soft">
          <span className="font-medium text-ink">Note:</span> {r.note}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {r.hasArtwork ? (
          <button
            onClick={onView}
            disabled={busy}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
          >
            View artwork {kb(r.artworkBytes)}
          </button>
        ) : (
          // Not an error. Either they described the piece in words, or the
          // upload was rejected and the row records the attempt.
          <span className="text-sm text-ink-soft">No artwork on this request</span>
        )}

        <input
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="What was agreed…"
          className="min-w-48 flex-1 rounded-lg border border-rule bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-soft"
        />

        {ACTIONS.map((a) => (
          <button
            key={a.status}
            onClick={() => onMove(a.status)}
            disabled={busy || r.status === a.status}
            title={a.hint}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
              a.status === "declined"
                ? "border border-red-200 text-red-700 hover:bg-red-50"
                : "bg-ink text-bone hover:opacity-90"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {viewingUrl && (
        <div className="mt-4 rounded-lg border border-rule bg-paper p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-ink-soft">
              This link expires in sixty seconds. Reload it by clicking View artwork again.
            </p>
            <button
              onClick={onCloseViewer}
              className="text-sm font-medium text-ink underline underline-offset-2"
            >
              Close
            </button>
          </div>
          {/*
            * next/image is deliberately not used. It would proxy the signed URL
            * through the optimiser, which caches by URL on disk — that is a copy
            * of a customer's photograph living outside the private bucket the
            * whole privacy story rests on. A plain <img> fetches it once, into
            * memory, and forgets it.
            */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={viewingUrl}
            alt={`Artwork submitted with ${r.reference}`}
            referrerPolicy="no-referrer"
            className="max-h-[32rem] w-auto rounded-lg"
          />
        </div>
      )}
    </article>
  );
}

export default function DesignQueue() {
  const [requests, setRequests] = useState<DesignRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Exactly one photograph on screen at a time, and its URL lives only here.
  const [viewing, setViewing] = useState<{ reference: string; url: string } | null>(null);

  /*
   * No setLoading(true) here. `loading` starts true, so the first call has
   * nothing to switch on, and the only other caller is the refresh after a
   * status change — where blanking the whole list to a spinner would throw away
   * the operator's place for a request that changes one badge. `busy` already
   * marks the row being acted on.
   *
   * It also keeps the effect below free of a synchronous setState, which is
   * what react-hooks/set-state-in-effect is warning about: a cascading render
   * on every mount.
   */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/design-requests");
      if (!res.ok) throw new Error(res.status === 401 ? "Session expired" : `Failed (${res.status})`);
      setRequests((await res.json()).requests);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * The rule flags any setState reachable from a function the effect calls. It
   * cannot see that every one of them here sits after an `await`, so none runs
   * in the synchronous body the rule is actually about — the cascading render
   * it warns of cannot happen. Same disable, and the same reasoning, as
   * OperationsDashboard and admin/page.tsx.
   */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function viewArtwork(reference: string) {
    setBusy(reference);
    try {
      const res = await fetch(
        `/api/admin/design-requests/artwork?reference=${encodeURIComponent(reference)}`,
      );
      if (!res.ok) throw new Error("That artwork is no longer available");
      const { url } = await res.json();
      setViewing({ reference, url });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the artwork");
    } finally {
      setBusy(null);
    }
  }

  async function move(request: DesignRequest, status: string) {
    if (status === "declined") {
      const gone = request.hasArtwork
        ? "\n\nThis DELETES their photograph. It cannot be recovered."
        : "";
      if (!confirm(`Decline ${request.reference}?${gone}`)) return;
    }

    setBusy(request.reference);
    try {
      const res = await fetch("/api/admin/design-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: request.reference,
          status,
          note: notes[request.reference] || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `Failed (${res.status})`);

      // If the photograph we were looking at has just been deleted, stop
      // looking at it. The signed URL would otherwise keep working for its
      // remaining seconds against an object that no longer exists.
      if (viewing?.reference === request.reference) setViewing(null);
      setNotes((n) => ({ ...n, [request.reference]: "" }));
      setError("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-soft">Loading design requests…</p>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-xl border border-rule bg-bone p-8 text-center">
          <p className="text-ink">No open design requests.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Photo and logo enquiries from /custom land here.
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">
          {requests.length} request{requests.length === 1 ? "" : "s"} waiting on you, oldest first.
        </p>
      )}

      {requests.map((r) => (
        <RequestCard
          key={r.id}
          request={r}
          note={notes[r.reference] ?? ""}
          busy={busy === r.reference}
          viewingUrl={viewing?.reference === r.reference ? viewing.url : null}
          onNote={(value) => setNotes((n) => ({ ...n, [r.reference]: value }))}
          onView={() => viewArtwork(r.reference)}
          onMove={(status) => move(r, status)}
          onCloseViewer={() => setViewing(null)}
        />
      ))}
    </div>
  );
}
