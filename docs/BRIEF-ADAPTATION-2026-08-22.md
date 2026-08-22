# Trust, discoverability and agent readiness, adapted to this shop

**Written 2026-08-22.** The brief this responds to was drafted for a voucher
marketplace: merchants, offers, vouchers, redemption, PUB-04 publishing rules,
`preview_url`, `ADR-0016`. None of those exist here. Rather than refuse it or
implement it literally, this translates it.

The translation matters more than it looks. Implementing "expose `redeem_offer`
as an MCP tool" against a shop with no vouchers would produce a tool that lies
about what the business does, and machine-readable lies are worse than silence.

---

## 1. Domain translation

| The brief says | Here that is | Note |
|---|---|---|
| merchant | the shop itself | One seller. There is no marketplace and no onboarding. |
| offer | product | 44 of them, `products.generated.ts`, generated from Postgres. |
| voucher | order | A physical object gets made. Nothing is issued to redeem. |
| redemption | fulfilment | Someone cuts MDF. It is not an API call. |
| `PUB-04` publishing rules | ADR-0001, hidden and unlisted products | Same job: keep non-public records out of public surfaces. |
| `ADR-0016` | ADR-0002 | This repo has one ADR, not fifteen. |
| `preview_url` | `product.imageUrl` | Already used for `og:image` on product pages. |
| eligibility, restrictions | none | Everything is AED 15 and available to anyone. Modelling eligibility would be inventing a rule the business does not have. |
| expiration state | stock and `hidden`/`unlisted` | Products do not expire. They go out of stock or get withdrawn. |

### Not applicable, with the reason

- **Agent-initiated redemption** (brief 3.7 steps 7 to 10). There is nothing to
  redeem. An agent could in principle place an order, but an order here starts a
  human making a physical object to a personalisation the customer typed. The
  interesting risk is not double-spend, it is cutting the wrong name into a
  board that cannot be uncut.
- **Merchant/location entities, `LocalBusiness`** (2.3). One workshop, one
  address, already in the `Organization` node. A `LocalBusiness` graph for a
  single made-to-order workshop with no walk-in trade would be structured data
  describing a shopfront that does not exist.
- **Webhooks and event bus** (section 6). There is no second system to notify.
  The operator is one person with an admin page and an email.
- **Multi-tenant agent authorization** (section 4). No third party holds
  credentials, so there is no delegation to scope.

---

## 2. What already exists

Checked by reading the code and the live site, not assumed. Several things the
brief asks for were already done, and two of my own earlier task notes
overstated the gaps.

| Brief item | State |
|---|---|
| `List-Unsubscribe` + `List-Unsubscribe-Post`, RFC 8058 one-click | Already correct, `src/lib/email.ts` |
| Newsletter double opt-in, `confirmed_at` | Already correct, migration 0008 |
| Per-product `generateMetadata`, canonical, OG, Twitter card | Already correct |
| `Product` + `Offer` JSON-LD | Already correct (task #71) |
| `Organization` + `WebSite` `@graph` | Already correct |
| `sitemap.ts`, `robots.ts`, framework-native, `force-dynamic` | Already correct |
| Privacy Policy, Terms, linked from footer and checkout | Already correct |
| Deny-by-default `/api/*` by explicit list | Already correct (D-016) |

---

## 3. What was actually missing

### Fixed, 2026-08-22

**Unsubscribe could not stop the promotional mail.**
`cart_recovery_sends.suppressed` was read by the send guard and written by
nothing, anywhere. Cart recovery is promotional mail to someone who typed an
address at checkout and did not buy; it carries one-click unsubscribe; pressing
it removed a newsletter row that did not exist and the next abandoned cart
mailed them again. `email.ts` warns in its own comments that a button which does
nothing teaches people to press "report spam", and complaints are what damage a
sending domain. Fixed with `suppressRecovery`, wired to both unsubscribe paths,
proven by reverting the call sites and watching the suite go red.

### Open, in priority order

**P0. Email class is not declared or enforced.** Templates are transactional,
operational or marketing by convention only. Nothing asserts that an opted-out
address still receives an order confirmation, or that a marketing send checks
suppression first. The cart-recovery defect above is what an unenforced
convention produces. Task #74's remainder.

**P0. One sending domain for everything.** A complaint spike on a newsletter can
stop an order confirmation reaching a paying customer. Note before starting:
`email.test.ts` exercises a rejection whose message is that lebon-grace.com is
not a verified Resend domain. Verify the current state first. Task #75.

**P1. No `og:image` on any page that is not a product.** `/`, `/shop`,
`/custom`, `/about`, `/faq` and `/links` all share on WhatsApp as a bare text
link with no picture. For a UAE shop WhatsApp is the primary organic channel,
which makes this the highest-return item in the brief. Task #77.

**P1. No `BreadcrumbList`.** Cheap, and it is what puts a category path under a
result rather than a bare URL. Task #77.

**P1. No leakage test.** ADR-0001 says hidden and unlisted products stay out of
public surfaces. Nothing asserts it, so the rule holds only as long as nobody
edits `sitemap.ts`. Task #78.

**P2. No public read API at all.** Every `/api/*` route is admin-gated or a form
handler. An agent can read the shop only by parsing pages, which is exactly what
the structured data is for. Whether that is a gap or the correct answer for 44
products is task #79's question, and it should be allowed to answer "no API".

---

## 4. Provisional answers to the ten questions

Full scoring is task #79. These are the honest positions from what is now known,
recorded so the later work has something to argue with.

1. **Genuinely headless?** No, and it does not claim to be. Business logic sits
   behind `src/lib/store.ts` and the `lib/` modules rather than in components,
   which is the useful half; there is no transport in front of it.
2. **API-first?** No. Deliberately: D-016 denies by default and every route is
   admin-gated or a form handler.
3. **MCP-ready?** No. Nothing to expose that a page does not already state.
4. **Would a CLI help?** For a single operator with an admin page, almost
   certainly not. The scripts that exist (`deploy-cx53.sh`, the artwork sweep)
   already cover the operational verbs.
5. **Can AI agents discover the products?** Partly. Server-rendered HTML, clean
   URLs, `Product` and `Offer` JSON-LD, a correct sitemap. The gap is social and
   image metadata, not comprehension.
6. **Can ChatGPT recommend them?** Probably, for anything it can crawl. It has
   price, availability, delivery terms and material per product.
7. **Can an agent transact?** No, and this needs a decision rather than a
   feature. Every order carries a personalisation that gets cut irreversibly.
8. **What blocks agentic commerce?** Mostly not us. Prior research
   (`RESEARCH-agentic-commerce-2026-08-19.md`) found Stripe's agentic suite
   excludes AE, OpenAI Instant Checkout is partners-only, and Google UCP is a
   US/CA/AU waitlist.
9. **Smallest set of changes?** The `og:image` work, `BreadcrumbList`, the
   leakage test, and a Merchant Center feed. That is the whole practical 2026
   surface for a UAE shop.
10. **What would put this ahead?** Not more protocol. The differentiator is free
    personalisation that no UAE competitor offers, and no schema expresses it.
    Making that machine-readable, in whatever standard eventually carries it, is
    worth more than an MCP server nobody calls.
