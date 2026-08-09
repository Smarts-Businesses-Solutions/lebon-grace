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

**If you ordered more than once:** go to **Account** and enter your email and
phone to see all of them together.

## Leaving a review

Once an order is delivered, you can review the pieces that were in it. Go to
**Review** and enter your order number and phone number. You can review each
piece once.

Reviews on this site can only be left by someone who actually received the item —
that is enforced, not a policy.

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

## Contact

The phone number, WhatsApp and email are on the **Contact** page. They are
revealed on request rather than printed in the page source, which keeps them out
of the hands of scrapers — you may need to click once to see them.

---

# For the workshop operator

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
