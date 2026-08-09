# Load test — 2026-08-08

ACTION_PLAN.md A-22, finding P-3. The scaling advice in the audit was
static-analysis only. This is the measurement that has to exist **before any
performance work is funded**, so that optimising is a response to a number
rather than to an intuition.

**Headline: nothing is under pressure, and nothing here justifies optimisation
work.** The numbers are recorded so the next person can compare rather than
re-argue.

## Method, and what these numbers are not

`autocannon` v8, 20 connections, 10 seconds per endpoint, against `next start`
running the production build.

Three caveats, because a number without its caveat is worse than no number:

1. **This ran on the Windows workstation, not on cx53.** It measures what the
   *application* can do on the hardware it happened to run on, not what
   production can serve. Do not quote these as capacity figures.
2. **Endpoints that touch Postgres were deliberately not load-tested.** That
   database is shared with twelve other tenants; hammering it to produce a
   throughput figure for a shop with one order would be an act of vandalism
   dressed as diligence. They were measured sequentially instead.
3. **No write path was tested at all.** Checkout creates real Stripe sessions.

## Rendered pages

| Path | req/s | p50 | p97.5 | max | non-2xx |
|---|---:|---:|---:|---:|---:|
| `/` | 980 | 19 ms | 28 ms | 60 ms | 0 |
| `/shop` | 1354 | 14 ms | 20 ms | 28 ms | 0 |
| `/shop/[slug]` | **386** | **50 ms** | 66 ms | 138 ms | 0 |
| `/track` | 1376 | 14 ms | 20 ms | 28 ms | 0 |

Zero errors and zero non-2xx across **43,690** requests.

**The one figure worth remembering is 386 req/s on the product page** — roughly
3.5× slower than every other page. It is the only route that is server-rendered
per request rather than served static, and it is the busiest page on a shop.
That is the ceiling to watch. It is also nowhere near being a problem: 386 req/s
is about 33 million page views a day.

## Database-backed and real-world latency

Measured sequentially, not under load.

| What | Result |
|---|---|
| `/api/products` (cold) | 1.23 s |
| `/api/products` (warm, ×5) | 0.409 – 0.414 s, very tight |
| `shop.lebon-grace.com` TTFB (cold) | 0.568 s |
| `shop.lebon-grace.com` TTFB (warm, ×4) | 0.320 – 0.340 s |

**The 410 ms on `/api/products` is mostly geography, not the query.** It is a
workstation in one country talking to Postgres in another. In production the app
and its database are on the same box, so the real figure is far lower — this
number is an upper bound, not a measurement of production.

The tightness of the warm figures (±5 ms over five runs) is itself the useful
signal: it says the cost is a fixed round trip, not a query that degrades.

## What this says about the audit's projections

P-3 projected trouble at 1,000 and 10,000 orders. Nothing here contradicts that,
and one of its predictions has already been acted on:

- **D-3 (`/account` seq scan)** — fixed in A-12. The `ilike` could not use an
  index at all; `EXPLAIN` now reports an index scan. That was the one projection
  worth pre-empting, because the fix was cheap and the failure mode was silent:
  correct results, quietly slower as orders accumulate.
- **S-3 (in-memory rate limiter)** — the persistence half is fixed in A-21. The
  horizontal-scaling half stands: buckets are still per-process, so a second
  replica would have its own.
- **The generated-catalogue design** costs nothing at request time, which is what
  the static-page numbers above show. Its cost is at build time and grows with
  catalogue size, not with traffic.

## When to re-run

Re-run before funding any performance work, and specifically if any of these
change: the catalogue passes a few hundred visible products; orders reach four
figures; or the product page stops being statically cacheable. Until then, this
file is the answer to "should we optimise?" and the answer is no.
