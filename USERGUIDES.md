# Lebon Grace — User Guides

**Last Updated:** 2026-08-09

Written for the people who *use* the shop, not the people who build it. Anything
internal belongs in [FOR-EVARISTE.md](FOR-EVARISTE.md) instead.

Two audiences: **customers** buying a puzzle, and the **workshop operator**
running the shop.

## Roles, and what this shop does not have

There are exactly two kinds of user: **customer** and **operator**. Within
"customer" there are no tiers, plans, or membership levels — everyone gets the
same prices and the same options, because there are **no customer accounts at
all**. Nothing to sign up for, nothing to upgrade.

The customer side splits into behaviours rather than accounts:

| Behaviour | What identifies them | Frequency |
|---|---|---|
| **Visitor** — browsing | nothing | any time |
| **Shopper** — buying | nothing; the basket lives in their browser | one-shot, occasionally repeated |
| **Tracker** — checking an order | order number + phone | a few times per order |
| **Reviewer** — after delivery | order number + phone, order delivered | once per piece per order |

**One language: English.** There is no translation layer and no locale
switching. Arabic with right-to-left layout is wanted and deliberately deferred
until the site is stable — see `docs/DECISION-ARABIC-RTL.md`. Any guide claiming
a language selector is describing something that does not exist.

---

# For customers

## Just looking

You do not have to buy anything, and nothing asks you to sign up. There is no
account, no cookie banner to dismiss, and no popup between you and the shop —
the analytics here do not use cookies at all.

**Finding a piece.** Three ways, and they end up in the same place:

- **Browse by category** from the header or the shop page — Alphabet &
  Literacy, Numbers & Counting, Shapes & Montessori, Animals & Nature, Vehicles
  & Making, 3D & Architecture.
- **Filter by price** on the shop page.
- **Search** from the box in the header. It usually jumps you straight to the
  piece or the category if it recognises what you typed, and otherwise shows
  everything matching. Recent searches are remembered in your own browser.

The shop tells you where you are — *"Showing 12 of 41 products"* — so you can
tell a filter from an empty catalogue. **If a category shows nothing at all,
that is worth telling us about**: it usually means stock was withdrawn and a
link outlived it.

**On a product page** you will find several photographs, the size in
centimetres, an age guide, and a small-parts warning where one applies. The
dimensions are measured from the piece itself rather than estimated. Engraving
is free and optional, and shown before you pay.

**Reviews.** If a piece has none, that section simply is not there — the shop
does not print "no reviews yet". Reviews can only be left by someone whose
delivered order actually contained that piece, so what you see is small but
real.

**If a link gives "Product Not Found"** the piece has been withdrawn or the link
is wrong. Since 2026-08-09 that page also returns a genuine 404, so old
bookmarks and stale search results drop out of search over time.

**Contact details are revealed on request** rather than printed on the page.
That is to keep them away from address-harvesting crawlers, not from you — one
click shows them.

## Buying a puzzle

1. Browse the shop, or filter by category and price.
2. Open a piece to see its photographs, size and age guidance.
3. **To have a name engraved**, tick the option and type it before adding to the
   basket. Engraving is **free** and up to **20 characters**. Each different
   name becomes its own basket line, so you can order one for Amira and one for
   Yusuf in the same go.

   **Check it in the basket.** The name you typed is shown on the basket line
   and again in the Order Summary on the checkout page, under "Engraving". It is
   cut exactly as written and the piece cannot be returned afterwards, so that
   is the moment to catch a typo. To change it, remove the line and add the
   piece again with the correct spelling.
4. Choose a quantity. You cannot order more than the workshop has material for,
   so the control stops at the available number.
5. In the basket, choose **delivery** or **collection**.
6. Check out. Payment happens on Stripe's page; card details never touch this
   shop.

**Delivery.** AED 20, free once the basket reaches **AED 150** — at exactly 150,
not above it. Collection is free.

**Your basket survives.** Closing the tab and coming back keeps both the basket
and your delivery choice. It is stored in your own browser, not on our server,
so it does not follow you to a different device.

**You do not need an account.** There is nothing to sign up for and no password
to forget.

## Before you buy — what cannot be undone

Every piece is cut **after** you order, so:

- a made-to-order piece **cannot be returned** because you changed your mind;
- a piece **engraved with a name can never be returned**, because it cannot go
  to anyone else — check the spelling, it is engraved exactly as typed;
- clearance stock is different and **can** be returned within 7 days, unused.

## After you order

You will get a confirmation email. Your piece then joins the making queue — every
item is cut to order, so it is made *after* you buy it, not taken off a shelf.

**To check on it:** go to **Track**, and enter your order number and the phone
number you ordered with. You will see which stage it has reached.

### Reading the tracker

Five stages, in order: **Payment Confirmed → Preparing → Shipped → Out for
Delivery → Delivered.** The bar fills as your piece moves along. Checking once
every day or two is plenty — made-to-order pieces take two to three working
days before they ship.

Once a courier has it, the **tracking number and courier name** appear on the
same page.

**If your order stopped.** Refunded, cancelled and not-completed orders leave
the five stages entirely and show a short explanation instead, with a button to
message us. You should never see an order sitting at an empty progress bar — if
you do, that is a fault worth telling us about.

- **Refund complete** — the money is on its way back. UAE cards usually take 5
  to 10 working days, and it may show as a pending transaction first.
- **Order cancelled** — nothing was charged.
- **Order not completed** — the order could not go through, and nothing was
  charged.

## Coming back — finding your orders again

There is no account to log into, and no password. **Account** is a lookup, not a
login: enter the **email address** and the **phone number** you ordered with, and
you get every order matching that pair, newest first.

Two routes, and they answer different questions:

| Page | You need | You get |
|---|---|---|
| **Track** | order number **+** phone | that one order, with its timeline |
| **Account** | email **+** phone | **every** order on that email and phone |

**Use Account when you have lost the order number** — it is the way back in when
the confirmation email has gone missing, because it needs nothing you were given
after the fact.

### Getting the phone number right

It is matched on the **last 8 digits**, so all of these are the same number and
any of them will work:

`0501234567` · `+971 50 123 4567` · `971501234567` · `050-123-4567`

What matters is that it is *the number you typed at checkout*. A different
number will not find the order even if it also belongs to you — there is no
account tying your numbers together.

Since 2026-08-09 a **too-short number is refused rather than accepted**. Entering
just the last few digits used to appear to work and could show an order that was
not yours; it now asks for the full number. Checkout refuses a short number too,
for the same reason: if the stored number cannot be matched, you would have no
way back to your own order.

### If it says no orders found

The message is deliberately the same whether the email is unknown or the phone
does not match — so that nobody can use this page to discover whether an address
has ordered here. That does mean it cannot tell you *which* of the two is wrong.
Check both, then:

- try the phone in another format (with `+971`, or with the leading `0`);
- try any other email you might have used — a work address, or the one attached
  to your card;
- if it still fails, **message us on WhatsApp**. There is no password reset,
  because there is no password; a human is the fallback, and we can find an
  order from a name and roughly when it was placed.

**Ten lookups an hour.** That is generous for someone checking their own order
and deliberately tight for anyone working through guesses. If you hit it, wait
and try again — nothing is wrong with your order.

### What a returning customer cannot do

There is nothing to keep signed in, no saved address, no order history beyond
the lookup, and no way to re-order in one click. Every visit starts the same way.
That is a deliberate trade — see `docs/QA/ACTORS.md` — the shop holds no account
to be broken into, and the basket lives only in your own browser.

## Leaving a review

Once an order is delivered, you can review the pieces that were in it. Go to
**Review** and enter your order number and the phone number you ordered with.
The page then lists the pieces from that order and marks the ones you have
already reviewed.

**Reviews here can only be left by someone who actually received the item.** That
is enforced by the database, not promised in a policy — every review row is tied
to an order by a foreign key. Four things must all be true before one is saved:

1. the order number **and** its phone match — the same pair `/track` uses;
2. that order is **delivered** (or completed);
3. that order **actually contained** the piece being reviewed;
4. you have **not already reviewed** that piece on that order.

Fail (2) and you are told to come back when it arrives. Fail (3) and it is
refused outright — otherwise one delivered order would license reviews of the
whole catalogue.

**What is published:** your rating, your comment, and **the name from the order**.
The name is taken from the order itself and not from anything sent with the
review, so nobody can sign someone else's name to an opinion. Your email, phone
and address are never shown.

**One review per piece per order.** Ordering the same puzzle twice earns a second
review, because that is a second delivery.

**Ten submissions an hour** — the same ceiling as the order lookup, because
guessing an order number and phone is the same guessing game.

**If the shop shows no ratings at all**, that is deliberate rather than broken: a
piece with no reviews shows nothing, rather than an empty star row that reads as
a bad score.

## If something goes wrong

**"Order Confirmed" never appeared.** If the payment failed you will stay on the
checkout page with an error and **your basket will still be full**, so you can
try again. Nothing was charged.

**A product link gives "Product Not Found".** That piece has been withdrawn, or
the link is wrong. As of 2026-08-09 the page also returns a proper 404 to
browsers and search engines rather than pretending the page exists, so an old
bookmark or a stale search result will drop out of search in time. Use the shop
grid to find the current range.

**You paid but got no email.** Check the address you typed, then use Track with
your phone number. If the order is not there, contact us — do not pay again.

**You cannot find your order number.** It is in the confirmation email. If that
is gone, use **Account** with your email and phone instead.

## Getting in touch — for enquirers

You do not need to have ordered anything. Three ways in, all on the **Contact**
page:

| Route | What happens |
|---|---|
| **The contact form** | Goes straight to the workshop's inbox, with your address set as the reply-to, so a reply lands back with you |
| **WhatsApp** | Opens a chat with a message already written; usually the fastest answer |
| **Phone / email** | Shown on request — see below |

**Why the phone number is not just printed.** It is revealed when you ask for
it, rather than sitting in the page source where address-harvesting crawlers
read it. You may need one click to see it. Nothing is hidden from you; it is
hidden from robots.

**If the form does not send.** You will be told, and asked to try again — the
shop does not claim your message went through when it did not. Try WhatsApp if
it keeps failing.

**Limits worth knowing.** The form accepts three messages an hour from the same
connection, and the reveal twenty. Both are generous for a person and useless to
a spammer. If you hit one, wait a little or use WhatsApp.

**Your email address has to be one that works.** As of 2026-08-09 the same check
runs on the contact form, the newsletter and checkout: an address with no
domain ending, a doubled dot, or a dot at the start or end is refused, because a
reply that bounces helps nobody. Ordinary addresses — including
`you+shop@gmail.com` and company subdomains — are fine.

## The newsletter

Subscribe from the homepage; unsubscribe at `/unsubscribe` with the same address.

**What actually happens when you subscribe.** Your address is stored, and that is
all — **no confirmation email is sent, and no welcome offer exists**. If you were
expecting one, nothing has gone wrong. Signing up twice is not an error either;
the second one is quietly ignored.

**How often will you hear from us?** Honestly: **not yet.** No campaign has ever
been sent from this shop. The page says "we will email you when there is
something new", and that remains true rather than imminent.

**Unsubscribing.** Enter the address at `/unsubscribe`. The row is **deleted
outright**, not flagged — keeping the address of someone who asked to be
forgotten is the opposite of what they asked for. It always says the same thing
whether or not the address was on the list, deliberately, so the page cannot be
used to work out who has subscribed. Five signups and ten unsubscribes an hour
per address-holder's connection, which no real person will notice.

Unsubscribing does **not** stop emails about orders you have already placed —
those have to be sent to fulfil the order.

### For the operator

Until 2026-08-09 the list was **write-only**: addresses went into a table that
nothing in the application could read — no admin view, no export, no send path —
so "we will email you" was a promise the shop had no mechanism to keep.

`GET /api/admin/subscribers` now returns the list and a count, and
`?format=csv` downloads it for whatever actually sends the mail. It is
**admin-only**, because it returns a list of people's email addresses; a new
file under `src/app/api/` is public the moment it is created, and that has
already bitten this project once.

There is still no sending path in the application, and that is deliberate — the
export exists precisely so one does not have to be invented here.

---

# For the workshop operator

## What arrives in your inbox without you asking

> ⚠️ **Nothing arrives yet.** As of 2026-08-10 the shop's sending domain is not
> verified on its e-mail provider, so every message is refused — this has been
> true for every e-mail the shop has ever attempted, including customer order
> confirmations (B-30). Verify `lebon-grace.com` at resend.com/domains, or point
> `MAIL_FROM_ADDRESS` at a domain already verified there. The list below is what
> you will get once that is done.

You do not have to sit in `/admin` waiting for something to happen. Five things
e-mail you:

| You get an e-mail when | It tells you |
|---|---|
| An order is paid | The pieces to cut, and a button that opens WhatsApp to that customer |
| An order is refunded | How much came back and whether it was partial — **stop work on it** |
| A refund arrives with no matching order | Nothing else will ever tell you; open the payment in Stripe |
| A paid order has no line items | Which Stripe session to open and repair by hand |
| Someone publishes a review | The rating and the comment — reviews go live unmoderated |

**Nothing e-mails you** for a newsletter signup (they are on the subscribers
list) or a failed admin login (rate-limited already; one alert per attempt would
be a flood).

The address is `ORDER_NOTIFY_EMAIL`, falling back to the shop contact address.
If it stops arriving, that is where to look first.

Until 2026-08-10 only the first of these existed. The other four were
`console.error` calls that the code believed were reaching the error tracker and
were not (B-29) — worth knowing, because it is the reason to trust the table
above only as far as the tests behind it.

## Signing in

Go to `/admin` and enter the admin password. The session lasts until it expires;
there is one shared login, so anything done here is attributed to "admin" and not
to a person.

After five failed attempts you are locked out for fifteen minutes. That limit
survives a restart, so waiting for a deploy will not clear it.

## The cutting queue

The first thing on `/admin`. It tells you what to make today and in what order.
Work top to bottom.

## Changing an order's status

Use the dropdown on the order.

> **Changing a status can email the customer.** Some statuses have a template and
> some deliberately do not; the ones that do send once, not on every save. Treat
> the dropdown as "tell the customer" rather than "make a note."

`deposit_paid` is what a new paid order looks like. If an order is paid but shows
nothing, that is a fault worth reporting — not a normal state.

## Editing products

You can create, update and delete products from `/admin`. Deleting is immediate.

Prices and the catalogue are generated from the database, so a change here is the
real change — there is no separate list to keep in step.

## Things to watch

- **A paid order that never appears** means the link from Stripe is broken. Say
  so immediately; nothing else will notice.
- **A customer says they were charged twice.** Check Stripe first — the shop
  refuses to process the same payment twice, so a genuine double charge is
  Stripe-side.
- **Never share the admin password.** There is only one, and it grants access to
  every customer's name, phone, email and address.
