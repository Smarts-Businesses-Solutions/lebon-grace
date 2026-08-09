# Decision — Arabic on the storefront

**ACTION_PLAN.md A-25.** The acceptance criterion is *"a deliberate decision either
way, rather than a default"*. This is that decision, and the research behind it
changed what the decision is about.

**Status: recommendation, awaiting one answer from the operator (see the end).**

---

## The finding that reframes this task

The plan filed A-25 as **P4, "Large", a UX nicety** — English-only in an Arabic
market. That framing is wrong, and the plan is corrected accordingly.

UAE **Federal Law No. 15 of 2020 on Consumer Protection** requires that suppliers
registered in the UAE and operating in e-commerce provide consumers with adequate
information **in Arabic** about the product, its specifications, and the terms of
contract, payment and warranty. More broadly, information, data, advertisements,
contracts and invoices must be in Arabic; other languages may be used *alongside*
it at the supplier's discretion.

Notably, these obligations attach to suppliers **registered in the UAE**. They do
not attach to e-commerce providers based outside it.

Lebon Grace makes its products in a Dubai workshop, sells to UAE consumers, and
takes live payments. If it is a UAE-registered supplier — which is the same
question A-23 already turns on — then **Arabic is not a growth idea. It is an
obligation, and the shop is currently not meeting it.**

That places A-25 in the same family as two findings already on the board:
`CODEBASE_AUDIT.md` §26.1 (toys sold for ages 1–3 with no EN 71-1 assessment) and
§26.3 (the clearance listing, now hidden). All three are the same shape: a live
shop making claims it has not underwritten.

> This is a reading of published summaries of the law, not legal advice, and the
> implementing regulation governs the detail. It is strong enough to justify
> asking a lawyer — which is the actual recommendation — and far too strong to
> leave filed as a P4 nicety.

**Sources:** [Federal Law No. 15/2020 (MoET, PDF)](https://www.moet.gov.ae/documents/20121/0/Law_15_2020_pdf.pdf/b676fd26-275c-3652-e949-8b3663e7bd79?t=1715057123879) ·
[UAE Ministry of Justice — full text](https://elaws.moj.gov.ae/UAE-MOJ_LC-En/00_CONSUMER/UAE-LC-En_2020-11-10_00015_Kait.html?val=EL1&Words=2015) ·
[K&L Gates — UAE Consumer Protection and E-Commerce](https://www.klgates.com/Update-UAE-Consumer-Protection-and-E-Commerce-Laws-1-23-2024) ·
[CMS — key provisions](https://cms.law/en/are/legal-updates/the-uae-s-new-consumer-protection-landscape-implications-and-key-provisions)

---

## The distinction that makes this affordable

The task was estimated "Large" because it was read as *build an Arabic RTL
storefront*. Splitting it in two makes the obligation much smaller than the
product ambition:

### Tier 1 — what the law appears to require (small)

Arabic **content** on the surfaces that carry product and contract information.
This needs translation and a language toggle. It does **not** need a mirrored UI.

| Surface | File | Why it is in scope |
|---|---|---|
| Product information and specifications | `src/app/shop/[slug]/page.tsx` | "the product… its specifications" |
| Terms of sale | `src/app/terms/page.tsx` | "terms of contract" |
| Delivery, payment and returns | `src/app/faq/FAQClient.tsx`, `src/app/terms/page.tsx` | "terms of… payment" |
| Warranty / faulty-goods promise | `src/app/faq/FAQClient.tsx` | "warranty" |
| Privacy notice | `src/app/privacy/page.tsx` | "information made available to consumers" |
| Order emails and receipts | `src/lib/email.ts` | "contracts and invoices" |
| Safety notice | `src/components/SafetyNotice.tsx` | ties to A-23; a safety warning nobody can read is not a warning |

### Tier 2 — full RTL storefront (large, and genuinely optional)

Mirrored layout (`dir="rtl"`), Arabic UI chrome, bidirectional-aware components,
Arabic typography, localised number and currency formatting. This is a **product
decision about market reach**, not a compliance one, and it can follow Tier 1 at
any distance.

Conflating the two is what made this look like a project rather than a task.

---

## Where the codebase actually stands

Better placed than expected for Tier 1, and honest about Tier 2:

- **No i18n framework at all.** Zero references to `next-intl`, `i18n`, `dir="rtl"`
  or `lang="ar"` anywhere in `src/` or `next.config.ts`.
- `src/app/layout.tsx:90` hard-codes `<html lang="en">` with no `dir`.
- Copy is inline JSX throughout, so Tier 1 means extracting strings first. That
  extraction is the real cost, and it is the same work whether or not Tier 2
  ever happens.
- Tailwind 4 supports logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`), so a
  later Tier 2 is much cheaper if new components use those instead of `ml-*`/`pl-*`
  from now on. **That is free to start today** and is the one thing worth doing
  before any decision.

---

## Recommendation

1. **Do not build Tier 2 now.** Nothing measured justifies it: 42 products,
   single-digit orders, and `docs/LOAD-TEST-2026-08.md` shows no pressure of any
   kind. A full RTL storefront is a market bet, and the market has not been
   tested.
2. **Treat Tier 1 as a compliance item, not a feature.** Get a written answer on
   UAE registration — the same answer A-23 needs — and if it is yes, put Tier 1
   on the same footing as the toy-safety work.
3. **Adopt logical properties now.** Free, invisible, and removes most of the
   later cost. Cheap enough that it needs no decision.
4. **Ask a UAE-qualified lawyer** what "adequate information in Arabic" requires
   in practice for a made-to-order workshop. That question also covers §26.1, so
   it is one conversation, not two.

## The one question this is blocked on

> **Is Lebon Grace a UAE-registered supplier?**

Same dependency as A-23, and it decides everything above. If **yes**, Tier 1 is a
compliance obligation on a shop already taking payments. If **no** — selling from
outside the UAE — these obligations do not attach, and A-25 reverts to exactly
what the plan first called it: an optional P4 growth idea.

Recorded 2026-08-08. Revisit when that answer exists.
