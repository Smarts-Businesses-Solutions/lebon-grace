import { adminActions } from "./store";

/**
 * Record an operator action, and never let the recording break the action.
 *
 * AD-02: an order can move to `refunded`, e-mail the customer "Refund issued",
 * and leave no trace that it happened or when. The order row shows the new
 * status — not the old one, not the time, not that a message went out. If a
 * customer says "I never asked to be cancelled" there is nothing to check.
 *
 * **Never throws, and never awaited by the caller.** The action the operator
 * asked for has already succeeded by the time this runs; failing to log it must
 * not turn a successful status change into an error page, and must not delay
 * the response. A failure here is itself logged, which reaches GlitchTip now
 * that console capture is configured (B-29) — so a silent audit log cannot
 * pretend to be a working one.
 *
 * `actor` is the operator's e-mail, taken from their signed session via
 * `adminActor(request)` — never from the request body, which the caller
 * controls and could set to anyone. Pass it through even when it is empty: a
 * session from before named logins existed, or one using the shared fallback
 * password, is genuinely unattributable and is stored as NULL. That is the
 * truth, and the reason 0007 shipped without the column at all rather than
 * filling it with a plausible fiction.
 */
export function recordAdminAction(
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {},
  actor?: string | null
): void {
  // `.catch` as well as the store's own error check: `void` on a rejecting
  // promise is an unhandled rejection, and this must never be able to take down
  // a request that has already succeeded.
  adminActions
    .record(action, targetType, targetId, details, actor)
    .catch((err) => console.error(`[audit] could not record ${action} on ${targetType}:${targetId}:`, err));
}
