/**
 * The order status set — declared once.
 *
 * It had drifted across four places: the Postgres CHECK constraint (10 values),
 * `ORDER_STATUSES` in the admin dropdown, `STATUS_INDEX` in the customer
 * tracker (6 values — the bug), and the `TEMPLATES` map in the email module.
 * Four statuses were settable by an operator and unrenderable by the tracker,
 * so a refunded customer saw an empty progress bar under a BLUE badge, which is
 * the colour the pipeline uses for "in progress".
 *
 * That is B-7's shape — a status nothing downstream recognises — and B-5's
 * consequence: telling a refunded customer their order is on its way.
 *
 * Anything consuming this should key off `OrderStatus` with
 * `satisfies Record<OrderStatus, …>`, so adding a status here fails `tsc`
 * everywhere it has not been handled, rather than silently rendering nothing.
 */
export const ORDER_STATUSES = [
  "deposit_paid",
  "paid",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "failed",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * How the customer's tracker should present each status.
 *
 * `step` is the index into the five-stage pipeline, or `null` for a state that
 * is not on it at all. A terminal state must NOT be drawn as a pipeline at 0%:
 * that is what made a refund look like an order about to begin.
 *
 * `tone` drives the badge. Deliberately not "everything that is not delivered
 * or cancelled is blue":
 *   - `refunded` is **neutral**, not a failure — the money went back, which is
 *     a completed outcome rather than an error.
 *   - `failed` and `cancelled` are **negative**: nothing was taken and nothing
 *     is coming.
 *
 * `paid` is a legacy transitional value. It is kept in the database CHECK
 * (migrations here are forward-only, and churning a constraint to delete a
 * value no row uses is not worth the risk) and mapped to the first pipeline
 * stage so that if it ever appears the tracker shows something true rather
 * than nothing.
 */
export interface StatusPresentation {
  /** Index into the 5-stage pipeline, or null when the status is not on it. */
  step: number | null;
  tone: "progress" | "done" | "neutral" | "negative";
  /** Headline shown instead of the pipeline for terminal states. */
  terminalTitle?: string;
  terminalBody?: string;
}

export const STATUS_PRESENTATION = {
  deposit_paid: { step: 0, tone: "progress" },
  paid: { step: 0, tone: "progress" },
  processing: { step: 1, tone: "progress" },
  shipped: { step: 2, tone: "progress" },
  out_for_delivery: { step: 3, tone: "progress" },
  delivered: { step: 4, tone: "done" },
  completed: { step: 4, tone: "done" },

  // Copy written for a small maker rather than a large retailer, and inviting
  // contact rather than explaining at length — WhatsApp is the default channel
  // for customers here.
  refunded: {
    step: null,
    tone: "neutral",
    terminalTitle: "Refund complete",
    terminalBody:
      "Your payment has been refunded. It usually reaches your card in 5 to 10 working days, and may show as a pending transaction first. If anything looks wrong, message us — we would rather hear from you directly.",
  },
  cancelled: {
    step: null,
    tone: "negative",
    terminalTitle: "Order cancelled",
    terminalBody:
      "This order was cancelled and nothing has been charged. If you meant to order something else, start whenever you are ready — or message us and we will help.",
  },
  failed: {
    step: null,
    tone: "negative",
    terminalTitle: "Order not completed",
    terminalBody:
      "This order could not go through, and no charge was made. Sorry for the trouble. Message us and we will sort it out with you.",
  },
} satisfies Record<OrderStatus, StatusPresentation>;
