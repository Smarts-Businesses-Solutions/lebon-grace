# Lebon Grace — Operations / Workshop Operator Deep Walkthrough

**Scope:** authenticated cutting queue, metrics and status workflow inspected from guide/source; unauthenticated production boundary checked without credentials. No customer/order/product data was accessed or changed.

## Evidence
`/api/metrics` and `/api/orders` both returned 401 without a session. The operations dashboard makes one metrics fetch after admin auth and renders a FIFO cutting queue, engraving text, age, delivery mode, operational alerts and metrics. The guide says the workshop should work the queue top-to-bottom.

## Confirmed findings

### OP-01 — MEDIUM — Operations dashboard has no recovery/refresh path after metrics failure
`OperationsDashboard` fetches `/api/metrics` once on mount (`OperationsDashboard.tsx:185–190`). On failure it renders only `Failed to load metrics` (`:200–202`), with no Retry control, timestamp, stale-data state or operator escalation action.

**Impact:** a workshop operator loses the day’s cutting queue without a self-service way to reload it; refreshing the entire admin page is the only implied workaround.

**Fix:** add retry, last-updated/stale state and failure correlation/support action. Consider retaining last successfully fetched queue in memory while a refresh fails.

### OP-02 — MEDIUM — Critical engraving data lacks an explicit read-back/acknowledgement step
The queue visually highlights engraving as irreversible (`:127–133`), but gives no completed/read-back marker or print/export workflow. A long queue requires operator memory/physical handoff outside the system.

**Impact:** a correct order can still be cut without its custom text when moving between screens/bench; remediation after cutting means remake.

**Fix:** per-line read-back/check-off with operator/time, printable cutting sheet or scanner-friendly queue, and a clear order-level completion handoff.

## Positive controls
Queue calls out paid orders without line items as blocking exceptions; started work is prioritised then FIFO; aged queue entries are highlighted; metrics and PII are protected behind admin authentication.

## Limit
A credentialed daily queue/actual customer transition was intentionally not opened. This report does not claim live metrics accuracy.
