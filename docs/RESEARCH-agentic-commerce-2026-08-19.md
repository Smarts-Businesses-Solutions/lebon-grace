# Structured data and agentic commerce: what the shop emits, and what an agent can do with it

Researched 2026-08-19. Two questions. First, what the shop's JSON-LD actually
contains, read from the source file rather than grepped for. Second, what exists
in August 2026 that would let an AI agent find this shop and buy from it.

Every structured-data claim is checked against Google's own documentation at
developers.google.com or against schema.org's own property pages. Every protocol
claim is checked against the spec's own site, the owner's own docs, or the
owner's own repository. Nothing here comes from a blog post about a spec. Where a
fact could not be established from a primary source it says so.

The live shop was queried directly on 2026-08-19, and three of the findings below
come from what it actually served rather than from what the repository says it
should serve.

---

## Part 1: what the shop emits today

### Where the JSON-LD lives

One block, in one file. `src/app/shop/[slug]/page.tsx`, lines 110 to 129, built
as a plain object literal with unquoted keys and serialised into a single
`<script type="application/ld+json">`.

A search for `@type` across the whole of `src/` returns matches in that file and
nowhere else. There is no second block anywhere in the app.

### Product, field by field

| Property | Present | Value emitted |
|---|---|---|
| `name` | yes | `product.name` |
| `description` | yes | `product.description`, full text including the paragraph break |
| `image` | yes | single-element array, absolutised against `getAppUrl()` |
| `sku` | yes | the slug, for example `abc-jigsaw-board` |
| `gtin` | **no** | |
| `mpn` | **no** | |
| `brand` | yes | `{ "@type": "Brand", "name": "Lebon Grace" }` |
| `aggregateRating` | **no** | |
| `review` | **no** | |
| `offers` | yes | one `Offer`, see below |
| `material` | **no** | |
| `audience` | **no** | |
| `size` | **no** | |
| `color` | **no** | |

`image` is written as `image ? [image] : undefined`. A key set to `undefined` is
dropped by `JSON.stringify`, so a product with no image emits no `image` key at
all rather than an empty array. Every listed product currently has one, so this
does not bite today.

### Offer, field by field

| Property | Present | Value emitted |
|---|---|---|
| `price` | yes | `String(product.price)`, so `"15"` |
| `priceCurrency` | yes | `"AED"` |
| `availability` | yes | `https://schema.org/InStock` |
| `itemCondition` | yes | `https://schema.org/NewCondition` |
| `url` | yes | absolute product URL |
| `priceValidUntil` | **no** | |
| `shippingDetails` | **no** | |
| `hasMerchantReturnPolicy` | **no** | |

Confirmed against the deployed site. A GET of
`https://shop.lebon-grace.com/shop/abc-jigsaw-board` returns exactly this
payload, with the correct host in `image` and `offers.url`:

```json
{"@context":"https://schema.org","@type":"Product","name":"ABC Jigsaw Board",
 "description":"...","image":["https://shop.lebon-grace.com/images/lasercut/abc-jigsaw-board-0.png"],
 "sku":"abc-jigsaw-board","brand":{"@type":"Brand","name":"Lebon Grace"},
 "offers":{"@type":"Offer","url":"https://shop.lebon-grace.com/shop/abc-jigsaw-board",
 "priceCurrency":"AED","price":"15","availability":"https://schema.org/InStock",
 "itemCondition":"https://schema.org/NewCondition"}}
```

### What is missing entirely

Checked `src/app/shop/[slug]/page.tsx` and `src/app/layout.tsx`, then confirmed
against the live site.

| Type | Present anywhere | Live check |
|---|---|---|
| `Organization` | no | homepage serves zero `application/ld+json` blocks |
| `WebSite` | no | same |
| `BreadcrumbList` | no | the product page has a visible breadcrumb and no markup for it |
| `LocalBusiness` | no | nothing on `/about` either |

`src/app/layout.tsx` sets Next `Metadata` only: title, description, icons,
keywords, OpenGraph. No JSON-LD, and nothing Google reads as an organisation
identity.

The breadcrumb gap is the cheap one. `ProductDetailClient.tsx` line 178 already
renders a visible breadcrumb, so `BreadcrumbList` markup would describe something
a user can actually see, which is the condition Google's general structured-data
guidelines impose.

---

## Part 2: validating against Google and schema.org

Sources:
<https://developers.google.com/search/docs/appearance/structured-data/merchant-listing>,
<https://developers.google.com/search/docs/appearance/structured-data/organization>,
<https://schema.org/Product>, <https://schema.org/Offer>,
<https://schema.org/ItemAvailability>.

### What Google actually requires

For a merchant listing, Google labels only three things required at the Product
level: `name`, `image`, `offers`. At the Offer level it requires only `price` (or
`priceSpecification.price`) and `priceCurrency` (or the equivalent inside
`priceSpecification`). Merchant listings, unlike product snippets, "require a
price greater than zero", and `offers` must be an `Offer` rather than an
`AggregateOffer`, "as the merchant has to be the seller of the product in order
to be eligible". Both hold here.

Two eligibility gates sit outside the property tables and both are already
satisfied. "Only pages where a shopper can purchase a product are eligible for
merchant listing experiences", and "Product rich results only support pages that
focus on a single product". The product page is a buy page for one product.

A third gate matters later, in Part 5, and is satisfied by accident of
architecture: Google requires that "structured data markup must be present in the
HTML returned from the web server" and that it "can't be generated with
JavaScript after the page has loaded". The block is emitted by a server component
wrapping the client one, so it is in the initial HTML. That was done to fix a
soft 404, not for this, and it happens to be the thing that makes a crawled feed
possible at all.

**The shop satisfies every required field.** Nothing currently emitted is wrong,
and nothing required is absent. That is worth stating plainly before the list of
gaps, because every gap is in the recommended tier.

Google's recommended list at Product level: `description`, `brand`,
`aggregateRating`, `review`, the `gtin` family, `mpn`, `sku`, `material`,
`audience` (`PeopleAudience` only), `size`, `color`. At Offer level:
`availability`, `itemCondition`, `url`, `priceValidUntil`, `shippingDetails`,
`hasMerchantReturnPolicy`.

Of that recommended set the shop already has `description`, `brand`, `sku`,
`availability`, `itemCondition` and `url`. It is missing nine.

All fourteen properties asked about are genuine schema.org properties, confirmed
on schema.org directly: `material` (Product, Text or URL), `audience`
(Audience), `size` (DefinedTerm, QuantitativeValue, SizeSpecification or Text),
`color` (Text), `priceValidUntil` (Date, "The date after which the price is no
longer available"), `shippingDetails` (OfferShippingDetails, "Indicates
information about the shipping policies and options associated with an Offer"),
`hasMerchantReturnPolicy` (MerchantReturnPolicy).

### The missing fields, ranked by whether they stop anything

Ranked on the question asked: which absence stops a shopping surface or an
assistant quoting price, availability and delivery cost correctly. Not ranked on
how many boxes each ticks.

**1. `shippingDetails`, or its Organization-level equivalent. Recommended, not
required. This is the one that matters.**

Delivery cost is the only fact a buyer needs that the page encodes nowhere
machine-readable. The rule lives in `src/lib/delivery.ts`: `UAE_DELIVERY = 20`,
`FREE_DELIVERY_OVER = 150`. It is rendered as prose in the FAQ and at checkout.
An assistant reading a product page has to infer AED 20 from sentences, and the
free-over-150 threshold interacts with quantity, so the inference is not even a
lookup. It is arithmetic on text.

Google's merchant listing doc is explicit about where this belongs: "We recommend
you provide a global shipping policy for your business under `Organization`
markup instead", with the per-`Offer` property reserved for products that
override the global rule. Every product here is AED 15 under one shipping rule,
so the Organization route is correct, and it is one block on one page rather than
41 copies.

The Organization doc gives the property as `hasShippingService`, taking
`ShippingService` with `shippingConditions` holding a `DefinedRegion` and a
`shippingRate` as a `MonetaryAmount`. Both `hasShippingService` and
`hasMerchantReturnPolicy` are recommended at Organization level. That page has no
required properties at all: "There are no required properties; instead, add the
properties that apply to your organization."

Two qualifications, both from Google's own shipping-policy and return-policy
pages, and both worth knowing before spending time on this.

First, omitting it costs an annotation, not eligibility. The properties are
"required if you want your shipping details to be eligible for the shipping
details enhancement", and the return equivalents are "required to make your
merchant listing eligible to show return policy information". Nothing about
either makes the listing itself ineligible.

Second, markup is the weakest link in a documented chain. Google's stated order
of precedence, strongest to weakest: Content API for Shopping account-level
settings, then Merchant Center or Search Console settings, then product-level
markup, then Organization-level markup. And explicitly: "if you provide both
shipping policy markup on your site and shipping policy settings in Search
Console, Google will only use the information provided in Search Console."

So for Google specifically, the account settings beat the markup. The markup is
still worth writing, because it is the only version of these facts that a
non-Google reader can see. An assistant fetching the page has no access to a
Merchant Center account.

**2. `hasMerchantReturnPolicy`, again at Organization level. Recommended.**

The shop has a real and unusually specific returns policy in
`src/app/terms/page.tsx` section 5: made-to-order and personalised items are not
returnable for change of mind, clearance stock is returnable within 7 days unused
and in original packaging, and anything faulty is replaced free on a photo within
7 days. None of that is machine-readable. For a made-to-order shop this is not a
detail. An assistant that cannot see the policy will either say nothing about
returns or assume a standard window that does not exist here.

`returnPolicyCategory` exists for exactly this case, and the split policy means
it is genuinely two entries rather than one.

**3. `audience`. Recommended.**

`details.age` is `"3-6"` on almost every product and `"4+"` on a few. Ages 3 to 6
is one of the two or three facts a parent filters on, and it is one of the claims
`docs/video/UPLOAD-KITS.md` treats as checkable. It is in the catalogue, it is in
the visible copy, and it is not in the markup. Google specifies `PeopleAudience`,
which carries `suggestedMinAge` and `suggestedMaxAge`, so the string parses
cleanly into structure.

**4. `material` and `size`. Recommended.**

Both already exist per product. `details.material` is `"3mm MDF, sanded by hand"`
and `details.dimensions` is a millimetre string such as `"196mm x 149mm"`. This
is close to free. `src/lib/product-filters.ts` already derives an
`EnrichedProduct` carrying `material`, `color` and `size` from the same data, so
a working extractor is already in the repo.

**5. `priceValidUntil`. Recommended.**

Low value here. It exists to stop a stale price being shown, and it matters most
for sale prices with an end date. Every listed product is AED 15 with no sale.
Adding it means committing to keep a date fresh, and Google states the only
documented consequence in this area is for a stale value rather than a missing
one: "Your listing may not display if the `priceValidUntil` property indicates a
past date." A date in the past is worse than no date. Skip until a promotion
ships.

**6. `color`. Recommended.**

The products are raw MDF. "Natural" would be honest and would add nothing a buyer
acts on. Lowest value on the list.

**7. `gtin` and `mpn`. Recommended, and correctly absent.**

These are manufacturer identifiers for mass-produced goods. Hand-cut
made-to-order items do not have them, and inventing one would be worse than
leaving it out. One note for later: OpenAI's product feed spec requires `gtin` or
`mpn` unless the row sets `identifier_exists=no`, so if a feed is ever built,
that flag is the correct answer rather than a fabricated code.

**8. `aggregateRating` and `review`. Recommended, and must stay absent.**

Zero customers means zero reviews. `src/app/api/reviews/route.ts` is built so a
review cannot exist without a delivered order that contained that product, which
is the right design and means there is nothing honest to emit. Emitting a rating
now would be fabricating one. Revisit after the first delivered orders, not
before.

### One value worth changing rather than adding

`availability` is `https://schema.org/InStock` on every product, and the source
comment concedes the point: "Made to order, so this is a promise about lead time,
not stock." schema.org defines `https://schema.org/MadeToOrder` as a member of
`ItemAvailability`, confirmed on the enumeration page alongside `BackOrder`,
`PreOrder` and the rest.

It is the accurate value and it matches the shop's whole positioning, and it
should still not be used. Google's own supported `ItemAvailability` list runs to
ten members and omits both `MadeToOrder` and `Reserved`, and the Merchant Center
feed accepts only four values: `in_stock`, `out_of_stock`, `preorder`,
`backorder`. The semantically correct value for this business is one Google does
not document support for, which is a genuine gap in the vocabulary rather than a
mistake in the code.

So keep `InStock`. It is not a lie: the item can be ordered right now. What is
invisible either way is the 2 to 3 working day lead time, and the property that
carries that is `handlingTime` on a shipping service, not the availability enum.
Leaving `InStock` and putting handling time in the shipping block is the right
trade, and it is another reason the shipping markup in the next section is the
highest-value item on the list.

---

## Part 3: robots.txt and sitemap.xml, and a live bug

### What the source says

`src/app/robots.ts` emits one rule group:

```
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /checkout
```

plus a `Sitemap:` line built from `getAppUrl()`.

`src/app/sitemap.ts` emits 7 static pages and one entry per product from
`products`, which excludes unlisted items. 41 products plus 7 static is 48 URLs,
and 48 is what the live sitemap contains.

### What the live site actually serves

Fetched 2026-08-19.

```
GET https://shop.lebon-grace.com/robots.txt

User-Agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /checkout

Sitemap: https://build-time-placeholder.invalid/sitemap.xml
```

```
GET https://shop.lebon-grace.com/sitemap.xml

<loc>https://build-time-placeholder.invalid</loc>
<loc>https://build-time-placeholder.invalid/shop</loc>
... 48 entries, every one of them on that host
```

**Every URL in the deployed sitemap points at a host that does not exist, and the
`Sitemap:` line in robots.txt points at the same non-existent host.**

This is not cosmetic and it is not a warning. The sitemaps.org protocol requires
that all URLs in a sitemap "use the same protocol and reside on the same host as
the Sitemap", and states that "URLs that are not considered valid are dropped
from further consideration." All 48 are cross-host, so all 48 are dropped. The
sitemap is functionally empty and the pointer to it in robots.txt is dead.

The rest of the page-level SEO is fine, which is why this has gone unnoticed.
`generateMetadata` runs per request, so the canonical link on a live product page
is correct: `https://shop.lebon-grace.com/shop/abc-jigsaw-board`, verified. Only
the two metadata routes are wrong.

### Why

Next.js documents both routes as cached by default. From the sitemap reference:
"`sitemap.js` is a special Route Handler that is cached by default unless it uses
a Request-time API or dynamic config option." The robots reference says the same
of `robots.js`. Both therefore run once, at build, and whatever `getAppUrl()`
resolves to inside the build container is baked into a static file.

`getAppUrl()`'s own docstring says APP_URL is "read at RUNTIME (preferred)" and
gives the reason: a wrong value would misdirect paying customers. That reasoning
holds for the Stripe redirect URLs, which are computed inside a request. It does
not hold for these two files, and the docstring's promise is exactly what makes
the bug invisible on a read of the source.

The string `build-time-placeholder` appears nowhere in the repository, so it
arrives in the `BUILD_ENV` blob Coolify writes into `.env.production.local` at
image build time (Dockerfile line 50). It was presumably set deliberately as a
tripwire for build-time inlining of `NEXT_PUBLIC_APP_URL`. It caught two files
nobody was watching.

The fix is one line in each file:

```ts
export const dynamic = "force-dynamic";
```

which makes both routes run per request against the runtime `APP_URL`, exactly as
the docstring already claims. The regression test is cheap: the existing suite in
`tests/e2e/seo/share-and-sitemap.spec.ts` already asserts the sitemap contains
`/shop/<listed>`, and it would have caught this had it asserted the host too.

### Would an explicit crawler allowlist change anything

No, and adding one carelessly would make things worse.

RFC 9309, the robots.txt standard, is explicit on group selection: matching
groups are combined, and "if no matching group exists, crawlers MUST obey the
group with a user-agent line with the `*` value, if present." A specific group
does not inherit from `*`. It replaces it.

So today, GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and Googlebot all fall
through to the `*` group and are all allowed everything except `/admin`, `/api/`
and `/checkout`. Adding a `GPTBot` group with `Allow: /` grants nothing that is
not already granted. Verified in practice: a request to a product page sent with
an OAI-SearchBot user agent returns 200, and nothing at the Caddy layer filters
by agent.

The trap is that a naive allowlist group carrying only `Allow: /` would stop that
agent inheriting the three disallows, opening `/admin` and `/checkout` to it. If
per-agent groups are ever added, every group must repeat the disallows.

There is one case where per-agent groups earn their place, and it is the opposite
of an allowlist. OpenAI documents four agents with different jobs:
`OAI-SearchBot` for surfacing sites in ChatGPT's search features, `GPTBot` for
training foundation models, `OAI-AdsBot` for ad landing-page checks, and
`ChatGPT-User` for user-triggered fetches, which OpenAI notes may not apply
robots.txt at all since it acts on a user's request. Splitting them lets the shop
be findable in ChatGPT search while opting out of training. That is a policy
decision about the product photography and copy, not an SEO one, and it is the
only reason to touch this file.

`Disallow: /admin` has no trailing slash, so it also blocks any future path
beginning with those characters. Harmless here, worth knowing.

### One unrelated thing the live check turned up

Product pages serve `Cache-Control: private, no-cache, no-store, max-age=0,
must-revalidate`. That is a checkout-grade header on a public catalogue page. It
does not stop indexing, but it defeats every intermediate cache and makes each
crawl a full origin hit through the SSH tunnel. Out of scope here, worth a look.

---

## Part 4: one real defect inside the JSON-LD block

The serialisation line ends with a replace of every `<` by the escape literal
`"<"`, under a comment claiming `JSON.stringify` "escapes the closing tag
sequence that would otherwise let a description break out". It does not, and
neither does the replace.

In a JavaScript source file the literal `"<"` **is** the single character
`<`. The expression therefore replaces every `<` with `<`. Verified in node: the
string before and after the replace compare equal, including when the input
contains a closing script tag.

`JSON.stringify` does not escape `<`, so a product description containing a
closing script tag would terminate the script element early and inject the
remainder as markup.

Not exploitable today. Descriptions come from the `products` table through a
build step, not from customers, and the admin route that writes descriptions sits
behind `requireAdmin`. The problem is that the comment asserts a protection that
is not there, so the next person to widen that input path will trust it. The
working form escapes the character in the emitted text rather than replacing it
with itself: the replacement string needs a doubled backslash, so that a
six-character escape sequence lands in the JSON text. A JSON parser reads it back
as `<`, and an HTML parser never sees the start of a tag.

---

## Part 5: agentic commerce standards as they stand in August 2026

### The shape of the answer, before the detail

Six months ago there was one candidate protocol. There are now three that matter,
they overlap, and two of them are led by the same companies. The specs are
genuinely open. **The channels are not.** Every route by which an AI agent can
today find this shop and complete a purchase is gated behind a platform's
approval queue, a waitlist, or a country list that does not include the UAE.

The single exception is the Google Merchant Center product feed, which is
self-serve, free, supports the UAE and AED, and is fifteen years old. It is not
an agent protocol, which is exactly why it is available.

That is the honest answer to the question posed. A product feed plus complete
structured data is very nearly the entire practical surface available to this
shop in 2026. The rest of this part is the evidence, and the two waitlists worth
joining anyway.

### 5.1 Stripe

Stripe now documents two protocols side by side and one product.

**The Agentic Commerce Protocol (ACP).** Home at <https://agenticcommerce.dev>,
repository at <https://github.com/agentic-commerce-protocol/agentic-commerce-protocol>.
Stripe's own docs describe it as "an open standard created by Stripe, OpenAI, and
Meta". Apache 2.0, contributor licence agreement required, date-versioned with
`2026-04-17` the latest stable version, status beta. No standards body is
involved.

The spec is six OpenAPI documents: agentic checkout, a checkout webhook, cart,
delegate authentication, delegate payment, and feed. Implementing it raw means
the merchant serves five endpoints that the agent platform calls:
`POST /checkout_sessions`, `POST /checkout_sessions/{id}`,
`POST /checkout_sessions/{id}/complete`, `POST /checkout_sessions/{id}/cancel`,
`GET /checkout_sessions/{id}`. Every call carries `Authorization`,
`Idempotency-Key`, `Request-Id`, `Signature`, `Timestamp` and `API-Version`
headers. The merchant also posts signed order lifecycle webhooks back.

**The Agentic Commerce Suite (ACS)** is Stripe's product, and it is the reason
this matters to a shop already on Stripe Checkout. On the managed path the
merchant serves no checkout API at all. The flow is: onboard in the Dashboard,
add terms, privacy policy and return policy, configure tax, upload a CSV catalogue
feed through the Product Catalog Import API, request a connection to a specific
agent, and then **receive ordinary `checkout.session.completed` webhooks carrying
a standard Stripe `CheckoutSession` object.** Stripe documents reading
`amount_total`, `line_items`, `payment_intent.latest_charge` and
`collected_information.shipping_details` off it, which is the same object
`src/app/api/stripe-webhook/route.ts` already handles.

So the answer to "does this work with Stripe Checkout or require a different
payment integration" is: on the managed path, it works with what is already
built, and Stripe does the protocol server work. That is genuinely the cheapest
agentic integration on offer anywhere.

**And it is not available here.** From Stripe's own seller documentation,
verbatim: "ACS is available in the US, Canada, and select European countries."
The published list is AT BE BG CA CH CY CZ DE DK EE ES FI FR GB GI GR HR HU IE
IT LI LT LU LV MT NL NO PL PT RO SE SI SK US. **AE is not on it.** The custom
integration path is US only and behind a waitlist. Stripe's agent-side products
(Order Intents, Link for agents, Extensible Checkout) are private preview.

Feed cadence on the managed path, for scale: product data daily, inventory and
pricing every 15 minutes. For a 41-product catalogue where every item is AED 15
and nothing goes out of stock, that is trivial. The gate is geography, not effort.

**Could not verify:** whether eligibility keys off the Stripe account's country
or the merchant's operating country, and therefore whether any structuring of the
business would change the answer. That is a question for Stripe support, not for
the docs.

### 5.2 OpenAI

Announcement at <https://openai.com/index/buy-it-in-chatgpt/>, developer
documentation at <https://developers.openai.com/commerce>.

A merchant must expose three things: a regularly refreshed product feed (CSV or
JSON, by file upload or REST), the five ACP checkout endpoints over HTTPS, and
order webhooks back to OpenAI. Payment is the merchant's own: OpenAI's docs state
"Merchants are expected to bring their own PSP" and that "OpenAI is not the
merchant of record". OpenAI calls `POST /agentic_commerce/delegate_payment` on
the **PSP**, receives a single-use vault token scoped by an allowance, and hands
it to the merchant at completion. The merchant charges it.

Production requirements are not trivial: TLS 1.2 or better on port 443 with a
valid public certificate, an allowlist of OpenAI's published IP ranges, HMAC
webhook signature validation, idempotency handling, documented sandbox logs
across every functional area, and "OpenAI may require your attestation of
compliance (AOC)" if cardholder data is touched.

**It is gated, and the gate is explicit.** From OpenAI's own get-started guide:
"Onboarding product feeds in ChatGPT is currently available to approved
partners." Applications go to <https://chatgpt.com/merchants>. At announcement
the live merchants were Etsy and selected Shopify sellers. OpenAI states
"Merchants pay a small fee on completed purchases" and publishes no percentage.

**Could not verify, and the absence is itself informative:** no supported-country
list and no supported-currency list appears anywhere in OpenAI's commerce
documentation. The feed spec accepts ISO 3166-1 alpha-2 `target_countries` and
ISO 4217 currency codes, and notes that a feed with market-specific processing
configured "rejects products using unconfigured codes". The US is the only country
named anywhere. AED eligibility is neither confirmed nor denied. No minimum order
value, catalogue size or sales history is documented.

For this shop the practical position is: the spec is public and could be
implemented; the approval queue is the actual product; a zero-customer UAE shop
selling a AED 15 item is not the profile Etsy and SKIMS represent. Applying costs
a form. Building the five endpoints before being approved would be building
against a door that has not opened.

### 5.3 Google

Google's protocol is not ACP. It is the **Universal Commerce Protocol (UCP)**,
announced January 2026, Apache 2.0, at <https://ucp.dev> with the spec at
<https://github.com/universal-commerce-protocol/ucp>. Co-developers named by
Google are Shopify, Etsy, Wayfair, Target and Walmart, with 20-plus endorsers
including Stripe, Visa, Mastercard and Adyen. Capabilities are Checkout, Identity
Linking, Order and Payment Token Exchange, offerable over REST, MCP or A2A. The
merchant remains merchant of record.

Notably, no Google primary source mentions ACP at all. The two ecosystems are
parallel, not layered.

**UCP merchant onboarding is a waitlist and a country list.** Google's support
page states "This article only applies to products with eligibility in the United
States, Canada, and Australia" and that it is "available for select merchants at
this time". It also requires a Google Pay and Wallet Console account with a Google
Pay integrated PSP. Google's Universal Cart is rolling out in the US, with UCP
checkout expanding to Canada, Australia, then the UK. The UAE is not in that
sequence.

**The Merchant Center feed is the open door, and it is genuinely open.**

- The UAE is a supported country and AED a supported currency. Google's own
  country table reads "United Arab Emirates" against "United Arab Emirates
  Dirham (AED)", with a dagger meaning "The Shopping tab is available to users
  in this country."
- Free listings are free and, per Google, "In most cases, the Free listings
  feature is turned on by default for you". Surfaces listed include Search rich
  results, the Shopping tab, Images, Lens, YouTube and **Gemini**.
- Requirements are a claimed and verified website, compliance with the free
  listings policies, return policy information on the website (already present in
  `src/app/terms/page.tsx`), and either shipping settings or the `shipping`
  attribute. Shipping settings are mandatory in around thirty named countries and
  the UAE is not among them.
- **No minimum catalogue size is documented.** The only documented quota is an
  upper one, 150,000 products. Note the distinction: no minimum is stated, which
  is not the same as a statement that there is no minimum.

Two feed details that bite this catalogue specifically.

**VAT.** Outside the US and Canada, feed `price` must include VAT. The shop's
terms say prices "include all applicable taxes unless otherwise stated", so AED
15 is already the right number to submit. No change needed, but it is the kind of
thing that silently disqualifies a feed.

**Identifiers.** Google's better answer for hand-made goods is not
`identifier_exists=no`. It is the manufacturer exception: "If you're the
manufacturer of a product (for example, custom or homemade goods), and you have no
official brand, use your store name as the brand along with an MPN with a unique
identifier number of your choice." So `brand` becomes Lebon Grace, which is
already what the JSON-LD says, and `mpn` becomes the slug or a workshop code.
That keeps products matchable instead of opting them out of matching, which is
what `identifier_exists=no` does.

**Automatic feeds mean the feed may not need building at all.** Google can crawl
structured data and the sitemap and construct the feed itself. It is opt-in, not
automatic: a data source has to be created, the website has to be verified and
claimed, robots.txt has to allow Googlebot, and all required attributes must be
present in the markup. Google checks "at least once every 24 hours".

The hard constraint is the one already noted in Part 2: "Structured data markup
must be present in the HTML returned from the web server. The structured data
markup can't be generated with JavaScript after the page has loaded." The shop
satisfies this. The sitemap requirement is the one it fails, because of the bug in
Part 3.

**How AI Mode gets prices.** Google's AI features page says "There are no
additional requirements to appear in AI Overviews or AI Mode" and "You don't need
to create new machine readable files, AI text files, or markup". Its AI
optimization guide is more useful: "Using products like Merchant Center (such as
Merchant Center feeds) and Google Business Profiles can help your products and
services to be visible in both AI responses and other Google Search results." The
Shopping Graph is fed by both merchant feeds and open-web crawling. **Google
publishes no precedence rule for what happens when feed and structured data
disagree.** Could not verify. The nearest documented behaviour is automatic item
updates, where landing page structured data corrects feed price and availability,
and a mismatch surfaces as an error.

### 5.4 Open specifications, and what adoption they actually have

**llms.txt.** A proposal by Jeremy Howard at Answer.AI, repository
`AnswerDotAI/llms-txt`, v2 last modified 2026-08-10. Not a standard: the README
calls itself "this proposal" and there is no IANA registration and no IETF or W3C
track. One required element, an H1.

No vendor documents reading it, and Google documents the opposite, verbatim:
"You don't need to create new machine readable files, AI text files, markup, or
Markdown to appear in Google Search (including its generative AI capabilities), as
Google Search itself doesn't use them", and "Doing so will neither harm nor help
your site's visibility or rankings in Google Search, as Google Search ignores
them." OpenAI's, Anthropic's and Perplexity's crawler documentation names
robots.txt and IP ranges and does not mention llms.txt at all, except as a link to
each vendor's own documentation index.

The pattern is worth naming plainly: **every lab publishes an llms.txt for its own
docs, and none documents reading yours.** The one real vendor touchpoint is a
Chrome Lighthouse audit under a new Agentic Browsing category, and Chrome's own
documentation calls the file "optional at the moment", marks a 404 as not
applicable, gives the category no score "because the standards for the agentic web
are still emerging", and claims no model reads it.

Verdict: ten minutes to write, harms nothing, does nothing. It is not a discovery
mechanism.

**Well-known discovery paths.** Checked the IANA registry directly. Exactly one
agent-related suffix is registered: `agent-card.json`, for A2A, which is
enterprise agent-to-agent task delegation and defines no commerce, catalogue,
checkout or payment semantics. Nothing is registered for commerce, MCP, AP2, ACP
or x402. OpenAI's old `/.well-known/ai-plugin.json` is dead: the `openai/plugins`
repository was archived on 2026-08-16 and is read only. At the IETF, an agent
protocols working group formation BoF at IETF 126 in July 2026 supported forming a
group but rejected the proposed charter, and **"discovery of AI agents is
explicitly out of scope."** The W3C has only Community Groups, whose reports carry
no standing.

Verdict: there is no registered path for a merchant to advertise commerce
capability, and the body that would register one has ruled it out of scope.

**AP2, the Agent Payments Protocol.** Owner site <https://ap2-protocol.org>,
repository `google-agentic-commerce/AP2`, Apache 2.0, version 0.2. Originally
Google, **donated to the FIDO Alliance on 2026-04-28**, where work continues in
the Agentic Authentication and Payments technical working groups. FIDO's own
announcement says only that "Work has commenced", with no published spec and no
timeline. The Python SDK is not on PyPI: "A PyPI package will be published at a
later time." Demos "mock actual payment service providers". No live consumer
surface transacting over it could be verified.

What a merchant would implement is mandate verification: checkout mandate JWTs,
hash checks, signed receipts. But the spec itself says "The exact details of the
Commerce Protocol (e.g., catalog APIs, checkout updates, and specific APIs for
communication between the different roles) are outside the scope of AP2."

The decisive sentence is in AP2's own FAQ: "If you are a merchant who would like
to showcase products and allow users to complete inline checkout on Google's AI
surfaces like AI Mode and Gemini, then you should use Universal Commerce
Protocol." The maintainers redirect merchants away from it. Ignore it.

**x402.** Owner Coinbase, contributed to the x402 Foundation under the Linux
Foundation, forty member organisations including Stripe, Visa, Mastercard,
Cloudflare, Shopify and Google. Mechanism is an HTTP 402 challenge and response,
"a single line of middleware" on the seller side. x402.org self-reports
"production-ready and has processed millions of transactions", which is the
owner's undated claim.

The disqualifier is the rail. It is stablecoin-first: USDC on Base is the
canonical path, other EVM chains and Solana are supported, and it is described as
"extensible to traditional payment methods" with **no fiat path documented today**.
It requires a wallet, a chain and a facilitator. It is a parallel payment rail,
not an addition to Stripe Checkout, and it is the wrong instrument for an AED 15
card payment from a parent in Sharjah.

A related IETF item, `draft-agentir-aepp`, is an individual draft by a single
author with "no formal standing in the IETF standards process".

### 5.5 Where MCP fits

The answer is clear and it is not the flattering one.

Spec version 2026-07-28 at <https://modelcontextprotocol.io/specification/latest>.
**The core spec defines no mechanism for finding a server from a domain.** Its
only `.well-known` use is `oauth-protected-resource`, which is discovered from a
`WWW-Authenticate` header after the server URL is already known. That is OAuth
metadata, not discovery. Well-known server discovery exists only as an open pull
request, SEP-2127 "MCP Server Cards", moved to in-review on 2026-08-07 with
changes requested. Not ratified.

There is an official registry, in preview, and publishing to it is genuinely open:
reverse-DNS namespaces verified by GitHub, DNS or HTTP challenge, with
"minimal-to-no moderation". But its own documentation says **"The MCP Registry is
not intended to be directly consumed by host applications."** It exists for
downstream aggregators.

How assistants actually connect: in Claude, a user pastes a URL under Customize,
Connectors. Listing in the Connectors Directory requires a Team or Enterprise
organisation, OAuth 2.0, a privacy policy, reviewer test credentials and human
review. In ChatGPT, a stable public HTTPS endpoint, domain verification and
OpenAI's review. Neither auto-discovers.

There is no payments story. Official extensions are Auth, MCP Apps and Tasks.
SEP-2007, "Payment Support for MCP Servers", was opened in December 2025 with
x402 as the first method and is closed, never accepted.

And there is a specific blocker: Anthropic's Software Directory Policy lists under
unsupported use cases "Software that transfers money, cryptocurrency, or other
financial assets, or executes financial transactions on behalf of users", not
permitted "unless expressly approved in writing".

**So, plainly, as asked: a merchant MCP server receives no organic shopping
traffic in August 2026.** Discovery is unratified, the registry is explicitly not
consumed by assistants, both major assistants require manual connection or gated
review, listing on Claude needs a paid plan the shop has no other reason to buy,
there is no payments spec, and the directory policy bars transacting connectors.

A merchant MCP server today is useful for exactly one thing: the merchant's own
tooling. Querying the catalogue, the production queue and order status from an
assistant instead of the admin UI. That is a real and defensible use. It is not a
sales channel, and it should not be built as one.

### 5.6 The card networks, and why they mean nothing needs building

**Visa Intelligent Commerce**, at
<https://developer.visa.com/capabilities/visa-intelligent-commerce>, targets AI
agents and platforms. Agents let users add Visa cards and then transact "at
Visa-accepting merchant locations". The documentation describes no merchant
enrolment path and no merchant implementation requirements, and states that
payments are "initially facilitated using guest checkout, key entry (form fill)".
The page carries a development disclaimer and says it may not be available in all
markets.

**Mastercard Agent Pay: could not verify.** The primary page returned 403 to an
automated fetch. What is verifiable from Stripe's own documentation is that Stripe
"may use Mastercard Agent Pay / Visa Intelligent Commerce network tokens on the
seller's behalf" on the custom ACS path, and from FIDO's announcement that Visa
and Mastercard chair the FIDO Payments technical working group.

The useful conclusion is the same either way, and it is a relief rather than a
gap: **an agent buying with a card through these programmes arrives at the shop as
an ordinary card payment.** Guest checkout and form fill is what a network token
looks like from the merchant's side. Nothing needs building for it. If an agent
ever drives a browser through this shop's Stripe Checkout, it will work today.

### 5.7 Summary table

| Route | Owner | Status | Merchant builds | Open or gated | Works with Stripe Checkout | Realistic now |
|---|---|---|---|---|---|---|
| Merchant Center feed and free listings | Google | Production, 15 years old | Feed, or opt in to automatic feeds from markup | Open, self-serve, free | Discovery only | **Yes** |
| Product and Organization structured data | schema.org and Google | Production | JSON-LD | Open | Discovery only | **Yes** |
| Stripe ACS, managed | Stripe | Beta | CSV feed, Dashboard onboarding | Gated by country, AE excluded | Yes, existing webhook | No, geography |
| Stripe ACS custom | Stripe | Waitlist, US only | Four reverse-API endpoints | Gated | No, token resolve and report | No |
| ACP raw | Stripe, OpenAI, Meta | Beta, Apache 2.0 | Five endpoints plus webhooks | Spec open, channel gated | No, delegated token via PSP | No |
| OpenAI Instant Checkout | OpenAI | Live, approved partners | Feed plus ACP endpoints plus webhooks | Gated, apply at chatgpt.com/merchants | No, own PSP charge | No, but the form is free |
| Google UCP checkout | Google plus co-developers | Production for select merchants | Feed attribute plus Google Pay console | Waitlist, US CA AU | No, Google Pay PSP | No, but the waitlist is free |
| AP2 | FIDO Alliance, from Google | v0.2, no FIDO spec yet | Mandate verification | Open spec, nothing to join | Not applicable | No |
| x402 | Coinbase, Linux Foundation | Live on crypto rails | HTTP 402 middleware | Open | No, separate rail | No |
| llms.txt | Answer.AI | Proposal | A markdown file | Open | Not applicable | Harmless, pointless |
| Merchant MCP server | Anthropic and contributors | Spec live, no discovery, no payments | A server nobody finds | Registry open, directories gated | Not applicable | Internal tooling only |
| Visa Intelligent Commerce | Visa | In development | Nothing | Not a merchant programme | Yes, arrives as a card payment | Already works |

---

## Part 6: what to do, cheapest and most certain first

Ordered by certainty of payoff against cost. Everything in the first group is
worth doing at zero customers. Everything in the last group is not.

### Do now, this week

**1. Fix the sitemap and robots.txt host. One line in each file.**

Unlocks: the sitemap actually existing. Right now 48 URLs are being discarded and
the `Sitemap:` pointer is dead, which also blocks the Merchant Center automatic
feed later, since that path reads structured data and the sitemap.

Cost: `export const dynamic = "force-dynamic";` in `src/app/robots.ts` and
`src/app/sitemap.ts`, plus one assertion in
`tests/e2e/seo/share-and-sitemap.spec.ts` that the sitemap contains the real host.
Under an hour including deploy verification.

This is first because it is the only item on the list where something already
built is currently broken, and because everything downstream depends on it.

**2. Add Organization JSON-LD to the homepage, carrying shipping and returns.**

Unlocks: the two facts an assistant cannot currently get without reading prose.
Delivery is AED 20, free over AED 150, free on collection. Returns are the real
split policy from the terms page. It also gives Google an organisation identity,
which currently does not exist anywhere on the site.

Cost: one JSON-LD block on `src/app/page.tsx`, roughly forty lines, using
`hasShippingService` with a `DefinedRegion` of AE and `hasMerchantReturnPolicy`
with two entries. Values come from `src/lib/delivery.ts` so they cannot drift.
Half a day.

Caveat worth holding: for Google specifically, Merchant Center and Search Console
settings outrank this markup. The reason to write it anyway is that a non-Google
reader has no other way to see these facts.

**3. Add `audience`, `material` and `size` to the product JSON-LD.**

Unlocks: ages 3 to 6, 3mm MDF and the physical dimensions becoming machine
readable. Age is the strongest filter a parent applies and it is currently
invisible.

Cost: about fifteen lines in `src/app/shop/[slug]/page.tsx`, reading
`details.age`, `details.material` and `details.dimensions`. Parsing "3-6" into
`suggestedMinAge` and `suggestedMaxAge` is the only real work, and
`src/lib/product-filters.ts` already has extractors for the neighbouring fields.
Two hours.

**4. Add `BreadcrumbList` JSON-LD to the product page.**

Unlocks: a breadcrumb trail in search results instead of a raw URL, and a clearer
category signal.

Cost: ten lines. The visible breadcrumb already exists at
`ProductDetailClient.tsx` line 178, so the markup describes something real. One
hour.

**5. Fix the escape in the JSON-LD serialiser.**

Unlocks: nothing today. Removes a comment that promises a protection that is not
there, before someone widens the input path and trusts it.

Cost: one character. Do it while the file is already open for items 3 and 4.

### Do next, this month

**6. Claim and verify the domain in Google Merchant Center, then turn on free
listings.**

Unlocks: the only agent-adjacent surface actually open to this shop. Free
listings feed the Shopping tab, Search, Images, Lens and Gemini, and the Shopping
Graph is what AI Mode reads for product data. The UAE is supported, AED is
supported, and the Shopping tab is available to users in the UAE.

Cost: an account, domain verification, and either a feed or an automatic data
source. Items 1 to 4 are the prerequisites for the automatic route, which is why
they come first. Budget a day, most of it waiting for verification.

Set `brand` to Lebon Grace and a self-assigned `mpn` per product rather than
`identifier_exists=no`. Prices already include tax, which is what the feed
requires outside the US and Canada. Product images are 1402 by 1122, comfortably
past the 500 by 500 minimum that becomes enforced in January 2027.

**7. Join two waitlists. Fifteen minutes total, no code.**

Google's UCP interest form, and OpenAI's merchant application at
`chatgpt.com/merchants`. Both are currently closed to a shop of this profile and
geography. Both cost a form. The expected value is low and the cost is lower, and
the alternative is finding out about eligibility a year late.

Do not build anything against either until an approval arrives. Building the five
ACP endpoints on spec, before a channel exists that would call them, is the single
most tempting waste of effort in this whole document.

**8. Decide the crawler policy deliberately, once.**

Not an SEO change. Today `User-agent: *` allows everything, so OAI-SearchBot,
GPTBot, ClaudeBot and PerplexityBot all have full access to the product
photography and copy. The only reason to split them is to stay findable in
assistant search while opting out of model training. That is a business decision
about the photographs, and it should be made on purpose rather than by default.

If per-agent groups are added, every group must repeat `Disallow: /admin`,
`/api/` and `/checkout`, because under RFC 9309 a specific group replaces the
wildcard group rather than inheriting from it.

### Only once there is demand

**9. `aggregateRating` and `review` markup.** Blocked by having zero reviews, not
by effort. The review system is already correctly built to require a delivered
order. Revisit after the first ten delivered orders. Never before.

**10. `priceValidUntil`.** Only when a promotion with an end date ships. A stale
date is worse than no date.

**11. A merchant MCP server, for internal use only.** Worth building the day the
admin UI becomes slower than asking. Not a sales channel, and nothing about that
changes if it is public.

**12. ACP or UCP endpoints.** Only after an approval arrives from a channel that
will call them. If Stripe's managed ACS ever opens in the UAE, the work is a CSV
feed and a Dashboard connection, not an API, because the webhook the shop already
handles is the same one. That is the version to wait for.

### What not to do

**llms.txt.** Google states in its own documentation that Search ignores it. No
vendor documents reading it. It is ten minutes and it buys nothing. If it gets
written anyway, write it knowing that.

**x402, AP2, any well-known commerce path.** No fiat rail, no ratified
registration, no consumer surface. Revisit in a year.

**Building ACP endpoints speculatively.** Covered above, and worth repeating,
because the spec is open and inviting and the channel is not.

### The one-sentence version

Fix the sitemap, put shipping and returns into Organization markup, put age and
material into the product markup, get into Merchant Center, join two waitlists,
and then go and get a customer, because none of this matters until the shop has
one.
