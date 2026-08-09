/**
 * The workshop's daily question: what do I cut today, and in what order.
 *
 * ACTION_PLAN.md A-15. Every piece is cut only after it is paid for, so the
 * backlog is not a stock level — it is a list of specific pieces, each belonging
 * to a named customer, some carrying a name to engrave. That question was only
 * answerable by opening the database.
 *
 * Pure on purpose: it takes orders and order items and returns the queue, so it
 * can be tested without a database and reused by any surface that needs it.
 */

/** Statuses that mean "not yet cut and shipped", in the order to work them. */
export const QUEUE_STATUSES = ["processing", "deposit_paid"] as const;

// Finish what is already started before starting something new — a piece left
// half-cut occupies the machine and helps nobody. Within a status it is strict
// FIFO: the customer who has waited longest is served first.
const STATUS_RANK: Record<string, number> = { processing: 0, deposit_paid: 1 };

export interface QueueItem {
  name: string;
  quantity: number;
  /** The name to engrave, or null for a plain piece. */
  engraving: string | null;
}

export interface QueueEntry {
  id: string;
  shortId: string;
  customer: string;
  status: string;
  placedAt: string;
  ageDays: number;
  deliveryMethod: string;
  emirate: string;
  /** True when any line needs engraving — the slow, unforgiving step. */
  engraved: boolean;
  pieces: number;
  items: QueueItem[];
}

type OrderRow = Record<string, unknown>;

/**
 * The engraved name for a line.
 *
 * Prefers the `personalisation` column added in 0004. Falls back to parsing the
 * "(engraved: …)" suffix out of `product_name` for rows written before that
 * column existed — which is exactly the fragility 0004 removes, kept only so old
 * rows still display. New rows never take this path.
 */
export function engravingOf(item: OrderRow): string | null {
  const explicit = typeof item.personalisation === "string" ? item.personalisation.trim() : "";
  if (explicit) return explicit;
  const name = String(item.product_name || "");
  const match = name.match(/\(engraved:\s*(.+)\)\s*$/);
  return match ? match[1].trim() || null : null;
}

/** Strips the "(engraved: …)" suffix so the piece name reads cleanly. */
function pieceName(item: OrderRow): string {
  return String(item.product_name || "Piece").replace(/\s*\(engraved:.*\)\s*$/, "").trim() || "Piece";
}

function daysBetween(from: string, now: Date): number {
  const placed = new Date(from).getTime();
  if (!Number.isFinite(placed)) return 0;
  return Math.max(0, Math.floor((now.getTime() - placed) / 86_400_000));
}

/**
 * Orders awaiting cutting, in the order to cut them.
 *
 * `now` is a parameter rather than read inside so the age calculation is
 * testable — an "is it 3 days old?" assertion against a moving clock is not a
 * test, it is a time bomb.
 */
export function buildProductionQueue(
  orders: OrderRow[],
  items: OrderRow[],
  now: Date = new Date()
): QueueEntry[] {
  const byOrder = new Map<string, OrderRow[]>();
  for (const item of items || []) {
    const key = String(item.order_id || "");
    if (!key) continue;
    const list = byOrder.get(key);
    if (list) list.push(item);
    else byOrder.set(key, [item]);
  }

  return (orders || [])
    .filter((o) => (QUEUE_STATUSES as readonly string[]).includes(String(o.status || "")))
    .map((o): QueueEntry => {
      const id = String(o.id || "");
      const lines = (byOrder.get(id) || []).map((item): QueueItem => ({
        name: pieceName(item),
        quantity: Number(item.quantity) || 1,
        engraving: engravingOf(item),
      }));
      const placedAt = String(o.created_at || "");
      return {
        id,
        shortId: id.slice(0, 8),
        customer: String(o.customer_name || "Customer"),
        status: String(o.status || ""),
        placedAt,
        ageDays: daysBetween(placedAt, now),
        deliveryMethod: String(o.delivery_method || "delivery"),
        emirate: String(o.emirate || ""),
        engraved: lines.some((l) => l.engraving),
        pieces: lines.reduce((n, l) => n + l.quantity, 0),
        items: lines,
      };
    })
    .sort((a, b) => {
      const rank = (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99);
      if (rank !== 0) return rank;
      // Oldest first. Orders with no timestamp sort last rather than first —
      // a missing date must not jump the queue ahead of a real customer.
      const ta = Date.parse(a.placedAt);
      const tb = Date.parse(b.placedAt);
      if (!Number.isFinite(ta)) return 1;
      if (!Number.isFinite(tb)) return -1;
      return ta - tb;
    });
}
