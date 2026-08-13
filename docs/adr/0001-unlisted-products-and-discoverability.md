# ADR-0001 — Unlisted products, and how the shop is discovered

**Status:** accepted · **Date:** 2026-08-13

## Context

Two problems arrived together.

The live shop takes payments, and no order had ever completed under the current
payment model — the one order in the database was from a deposit-and-COD flow
since deleted. Proving the money path needed a real purchase, and a real
purchase needs something cheap to buy that customers never see.

Separately, every product page served the root layout's metadata: 41 products,
one title, one description, two `og:` tags. A link shared on WhatsApp — this
shop's actual distribution channel in the UAE — rendered a generic card, and
Google saw 41 duplicate titles.

## Decision

**"Unlisted" is a distinct state from "hidden".** `hidden` retires a product and
the generator drops it entirely, so a hidden product cannot be bought at all.
`unlisted` keeps it fully purchasable while removing it from every listing.

**The default is inverted rather than filtered at each call site.** `products`
is used ~99 times across 13 files. Rather than add `.filter(p => !p.unlisted)`
to each — one forgotten filter away from putting an internal item in a
customer's shop — the exported `products` IS the listed set, and the full set
(`allProducts`) is module-private. Only `getProductBySlug` sees everything.

**Unlisted implies `noindex`.** Absent from listings and sitemap is not enough;
without it the internal test item would still have been indexable.

**Metadata is per product**, with canonical, OG image, Twitter card and
`schema.org/Product` JSON-LD carrying price and availability.

## Consequences

Two call sites had to change: checkout and variants both looked products up by
slug against the browsable array and would have refused to sell an unlisted
item. Both should have used `getProductBySlug` regardless.

The test item is priced at **AED 2, not 1** — Stripe rejects charges below 2.00
AED, so an AED 1 product would fail at payment and prove nothing.

Adding a product is now a deploy, not a database insert: the catalogue is a
build-time artifact (`products.generated.ts`) and checkout validates prices
against it.

## Alternatives rejected

**A visible cheap product.** Simplest, but it sits in a real customer's shop
labelled "please do not order".

**Buying an existing AED 15 product.** Costs ~AED 0.35 more in unrecoverable
Stripe fees and needs no code — genuinely reasonable, and the right choice for
a one-off. Rejected because the value is in repeating it after every deploy,
which a permanent fixture makes free.

**Filtering unlisted at each call site.** Rejected above: the failure mode is
silent and customer-facing.

## What this does not decide

Whether unlisted products should appear in `/admin`. They do today, via the
admin API, which is correct — an operator needs to see the thing they are
testing with.
