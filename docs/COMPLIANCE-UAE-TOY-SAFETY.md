# UAE toy safety — what applies, what we have done, what is still open

Written 2026-08-04, after the MDF import took the catalogue from 42 to 95
visible products.

**This is an engineering summary of public guidance, not legal advice and not a
conformity assessment.** Nothing here certifies anything. The items under
"Still open" need a conformity body or a lawyer, not a commit.

---

## 1. What the rule actually is

Toys are a **regulated product** in the UAE. The relevant machinery:

- **ECAS** (Emirates Conformity Assessment Scheme), run by **MoIAT** — the
  ministry that absorbed ESMA. ECAS is described as a *pre-market* requirement:
  a regulated product is meant to be registered and hold a Certificate of
  Conformity before it is offered for sale.
- **Gulf Conformity Mark (G Mark)** — the mark that shows a toy meets GCC-wide
  safety requirements. Public guidance states it applies to **all toys designed
  or intended for play by children under 14**, and that it is legally binding
  across the major GCC markets including the UAE.
- **GSO EN 71 series** — the harmonised standards behind it:
  - **EN 71-1** mechanical and physical: small parts, sharp edges and points,
    drop and torque testing
  - **EN 71-2** flammability
  - **EN 71-3** migration of certain elements (chemical, i.e. what leaches out
    if a child mouths the item — directly relevant to painted or sealed MDF)
- Products aimed at **children under three** get the closest scrutiny, because
  that age group mouths components.
- A toy **not** suitable for under-threes must say so **and give the reason**
  (choking hazard), as words or a pictogram.

Sources: [TÜV Rheinland on ECAS](https://www.tuv.com/market-access-services/en/certification-filter/uae-moiat-ecas-certification-(emirates-conformity-assessment-scheme).html),
[Intertek on ECAS](https://www.intertek.com/government/product-conformity/ecas/),
[G Mark for toys](https://instacertify.com/certification/emea/g-mark-toys),
[EN 71 overview](https://en.wikipedia.org/wiki/EN_71),
[ESMA toy standards](https://gulfnews.com/uae/government/esma-sets-new-standards-for-toys-1.1429556).

## 2. Why this bites us specifically

Lebon Grace is not a reseller moving certified stock. It **manufactures** the
goods — drawn as a cutting file, cut from 3mm MDF on our own laser, sanded by
hand — and sells them direct to consumers in the UAE. That makes us the
responsible party. There is no importer upstream whose certificate we inherit.

Three facts about the current catalogue make this concrete:

1. **Every product has loose pieces.** The entire range is sheet MDF cut into
   parts that lift out. Small parts are not an edge case here, they are the
   product.
2. **11 visible products claim suitability for ages 1–3.** That is the
   under-three band, the one under closest scrutiny, on items that by
   construction contain small parts. This combination is the single highest
   risk item on this page.
3. **54 of 95 visible products carry no assessed age at all** — the 53 MDF
   items imported on 2026-08-04, plus the clearance listing.

Payments are live. This is not theoretical exposure.

## 3. What has been done in code (2026-08-04)

`src/components/SafetyNotice.tsx`, rendered on every product page:

- Shows the assessed age range where one exists. It already existed in
  `details.age` for 41 products and drove the shop's age filter, but was
  **never displayed** — a parent could filter by age and land on a page silent
  about age.
- Shows a **choking hazard / contains small parts** warning with the reason and
  "not suitable for children under 3", which is the form the guidance asks for.
- Where no age has been assessed, says so plainly rather than inventing a
  number. A fabricated age rating on a children's product is worse than an
  honest gap, because it reads as though someone checked.

**This is labelling. It is not conformity.** It reduces the chance of a child
being handed an unsuitable item; it does not make the products compliant.

## 4. Still open — needs a decision, not a commit

- [ ] **Is Lebon Grace registered with MoIAT / ECAS?** Everything below depends
      on the answer. If not registered, the question is not "label correctly" but
      "register first".
- [ ] **EN 71-1 / -2 / -3 testing** through an accredited lab. -3 matters most:
      whatever finish or paint goes on MDF is what a child mouths.
- [ ] **Resolve the 11 products labelled 1–3.** Either they pass EN 71-1 small
      parts for under-threes, or the age claim comes off. Right now the site
      asserts under-three suitability with no assessment behind it, and the new
      notice contradicts it on the same page.
- [ ] **Assess ages for the 54 unrated products** — properly, per item.
- [ ] **Physical labelling.** The warning belongs on the product or its
      packaging, not only on the web page.
- [ ] **Decide on the "Kids Toys" category name.** It is an explicit statement
      of intended use, which is what pulls a product into scope.

## 5. Recommendation

Get a written answer to the registration question first — it is one email to
MoIAT or to a conformity consultancy, and it determines whether the rest is a
labelling exercise or a registration project. Until then, the 11 under-three
claims are the thing worth removing, because that is the specific combination
(under-three + small parts + no assessment) that the standards single out.
