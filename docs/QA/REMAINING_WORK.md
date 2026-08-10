# What is left, and what each one needs from you

Every audit finding that could be settled in code is fixed, deployed and
verified. Four items were blocked on a decision only you could make. **Three are
now answered and two of those are built.** This file records what was decided
and why, so the reasoning survives past the conversation it happened in.

---

## AD-02 — per-person admin identity ✅ BUILT

**Answered 2026-08-11:** yes, two people will use `/admin` —
`wanresionne@gmail.com` and `smarts.businesses.solutions@gmail.com`.

Built as named logins with credentials in the **environment**, not the database.
The full reasoning is **D-018**; the short version is that a database-backed
login fails closed during a database outage, which is exactly when someone needs
`/admin`. This was demonstrated rather than argued: the verifying E2E ran
against a server with no database at all and the login worked.

`admin_actions.actor` (migration 0009, applied) now records who. It is nullable
forever, because three cases genuinely have no actor — rows written before this
existed, sessions using the shared fallback password, and anything the system
does on its own behalf. `NULL` reads as "not attributable", which is true.

**One step left, and it is yours** — see *Operator actions* below. Until
`ADMIN_USERS` is set, `/admin` still shows a password-only form and the trail
still records `NULL`. Nothing is broken in the meantime; it simply is not on yet.

---

## OP-02 — engraving read-back before cutting ✅ BUILT

**Answered 2026-08-11:** no engraving has ever been cut wrong.

So the recommendation stood: **show it louder, buy no friction.** The engraving
now takes its own row in the cutting queue — isolated, monospaced at `text-base`,
wrapping rather than clipping. It used to sit inline beside the product name at
11px, which is legible but skimmable, and skimming is the failure mode when the
eye reads "Zoe" for "Zoë".

Deliberately **not** a tick-to-confirm and **not** a type-it-back. A confirmation
nobody asked for becomes a reflex click within a week (L-5), and a dismissed
control is worse than no control because it looks like one. If a piece is ever
actually mis-cut, that is the moment to add typing-back — and the moment it will
be worth the friction to everyone using it.

---

## TR-03 — a production regression for the returned-order lifecycle 🔨 QUEUED

**Answered 2026-08-11: build the staging database.**

The problem in plain terms: there is exactly one database, the live one with
real orders. A test that follows an order all the way to `refunded` has to
create an order, walk it through statuses, and delete it. Run that automatically
on every CI run and it is writing and deleting real rows in the live shop
several times a day — and a run that dies halfway leaves a fake order sitting in
the workshop queue. Playbook **P-006** covers it manually for exactly that
reason.

A staging database is a second copy the tests can wreck freely. The automation
was never the hard part; the safe place to run it was.

**Queued as task #68.** Scope: a second Postgres on cx53 with its own volume and
credentials, migrations `0001`→head applied to it (which doubles as the A-8
forward-migration check), staging credentials in CI and in `supabase.local`, the
lifecycle test pointed at it by env, and — the guard that matters — **the test
refuses to run if handed the production URL.** That is the failure this whole
task exists to prevent, so it should be impossible rather than merely avoided.

---

## #19 / #20 — blue-chip products, CJ intelligence layer 💬 NEEDS A BRIEF

These are not defects and not technical work. Both are commercial questions that
happen to be sitting in an engineering tracker, which is why they read as
mysterious. In plain terms:

**#19 — "add proven/blue-chip products".** *Which things should the shop sell?*
Right now the catalogue is what it is. "Blue-chip" means products already proven
to sell — rather than guessing. Nobody can pick those for you: it depends on
what you want to make, what your workshop can produce well, what margin you need,
and who you are selling to. There is no code blocked behind this. The moment you
say "stock these five things", stocking them is an afternoon.

**#20 — "CJ product intelligence layer".** CJ is the supplier API already wired
up (it filled in product data during the catalogue build). "Intelligence layer"
was a note-to-self that never got defined: it could mean price-change alerts,
stock warnings, competitor comparison, or automatic new-product suggestions.
Each is a different build, and until it is clear *what decision it should help
you make*, building any of them is guessing.

**What either needs from you** is a sentence or two — not a specification. For
#19: what kind of product, and roughly what price range. For #20: what question
you want it to answer. Everything else follows from that.

If neither is a priority right now, that is a legitimate answer too, and better
than a half-built feature nobody asked for. They can sit closed until they
matter.

---

## Operator actions — the things only you can do

**1. Set up your two admin logins.** For each address, run:

```bash
node scripts/admin-password-hash.mjs wanresionne@gmail.com
```

It asks for a password with typing hidden, and prints one line. It never
stores or transmits the password — only the printed line leaves the script, and
that line cannot be turned back into the password. Repeat for
`smarts.businesses.solutions@gmail.com`, then set both, comma-separated:

```
ADMIN_USERS="wanresionne@gmail.com:<line1>,smarts.businesses.solutions@gmail.com:<line2>"
```

…in `/root/build/buildenv.txt` **and** the Coolify compose env, then recreate the
container. It is a runtime variable, so no rebuild is needed.

Use a password of at least 12 characters; the script refuses anything shorter.
This is the only lock on the shop's admin.

**Keep `ADMIN_PASSWORD` set until you have logged in with a named account at
least once.** It is the way back in if a hash is pasted wrong. Remove it once
named logins are proven — that is what turns off the shared password for good.

**2. Revoke the old Resend API key.** The replacement is proven delivering
(`status=delivered`, verified end to end). The old key was exposed in session
output and is still live until you revoke it.

**3. Save the new Resend key to `supabase.local`.** It was deliberately never
seen from here — handling key values is what produced the leak in the first
place.
