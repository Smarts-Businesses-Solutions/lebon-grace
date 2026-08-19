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

/**
 * Statuses an operator may actually choose in `/admin`.
 *
 * Everything except `paid`, which is a legacy transitional value: it is kept in
 * the database CHECK because migrations here are forward-only and no row uses
 * it, and the tracker maps it so that if it ever appears the customer sees
 * something true — but nothing should be able to put an order INTO it.
 *
 * That matters more than it looks. `paid` is not in `QUEUE_STATUSES`, so an
 * order moved to it disappears from the cutting queue while still looking paid
 * to the customer. That is B-7 exactly, which reached production once already
 * when the webhook wrote `paid` and nobody could see the order to make it.
 *
 * `/admin` used to hand-maintain its own copy of this list. It was correct, but
 * only by attention: a status added to ORDER_STATUSES simply would not appear
 * in the dropdown, and nothing would say so. Derived here instead, so the
 * exclusion is a stated decision rather than an omission.
 */
export const SETTABLE_STATUSES = ORDER_STATUSES.filter((s) => s !== "paid");

/** Can an operator move an order to this status? */
export function isSettableStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (SETTABLE_STATUSES as readonly string[]).includes(value);
}

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
      "Your payment has been refunded. It usually reaches your card in 5 to 10 working days, and may show as a pending transaction first. If anything looks wrong, message us. We would rather hear from you directly.",
  },
  cancelled: {
    step: null,
    tone: "negative",
    terminalTitle: "Order cancelled",
    terminalBody:
      "This order was cancelled and nothing has been charged. If you meant to order something else, start whenever you are ready, or message us and we will help.",
  },
  failed: {
    step: null,
    tone: "negative",
    terminalTitle: "Order not completed",
    terminalBody:
      "This order could not go through, and no charge was made. Sorry for the trouble. Message us and we will sort it out with you.",
  },
} satisfies Record<OrderStatus, StatusPresentation>;

/**
 * Statuses whose selection sends the customer an e-mail.
 *
 * Duplicated from `email.ts`'s TEMPLATES on purpose, and guarded by a test that
 * fails if the two disagree (`email.test.ts`). The duplication exists because
 * `isEmailable` lives beside the Resend client, and a client component importing
 * it would pull the mail SDK into the browser bundle — but an admin UI that
 * cannot tell which changes reach a customer is how AD-01 happened: a `<select>`
 * fired the change on `onChange`, and until 2026-08-10 nothing was delivered
 * anyway, so the mistake was invisible. E-mail works now, so a mis-click reaches
 * a real person.
 *
 * The test is what makes this safe: add a template without adding it here and
 * the build fails, rather than the admin silently mailing customers unwarned.
 */
export const NOTIFIES_CUSTOMER: ReadonlySet<string> = new Set([
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
]);

/** Will moving an order to this status e-mail the customer? */
export function notifiesCustomer(status: string): boolean {
  return NOTIFIES_CUSTOMER.has(status);
}

/**
 * One display name per status, for customers and operators alike.
 *
 * The two surfaces had drifted. /track called `deposit_paid` "Payment
 * Confirmed" and `processing` "Preparing"; /admin called the same states
 * "Deposit Paid" and "Processing", and its dropdown just replaced underscores,
 * so an operator read raw column values.
 *
 * "Deposit Paid" is the stale one — there is no deposit, Stripe collects the
 * full amount. The customer page was already right, which is the opposite of
 * where you would look for the correct wording.
 *
 * THE KEYS DO NOT CHANGE. `deposit_paid` stays as the stored value: track,
 * admin, the operations pipeline and the metrics buckets all filter on it, and
 * renaming it once made new orders invisible in all four simultaneously. The
 * name was the only stale thing, so the name is the only thing fixed.
 */
const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment",
  deposit_paid: "Payment confirmed",
  paid: "Payment confirmed",
  processing: "Preparing",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Payment failed",
};

/** A human name for a status; falls back to the raw key made readable. */
export function statusLabel(status: string | null | undefined): string {
  const key = String(status || "").toLowerCase();
  return STATUS_LABEL[key] || key.replace(/_/g, " ") || "Unknown";
}
