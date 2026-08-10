# What is left, and what each one needs from you

Every audit finding that could be settled in code is fixed, deployed and
verified. Four remain. None is blocked on effort — each is blocked on a
**decision only you can make**, and this file exists so that decision can be made
in one sitting instead of being re-explained each time.

For each: what the problem actually is, the realistic options with their
trade-offs, a recommendation, and what implementing it would touch.

---

## AD-02 (second half) — per-person admin identity

**Done already:** the action trail. `admin_actions` records order status changes
and product edits/deletions, with before-and-after values (B-42).

**Still true:** every action reads as "the admin", because there is one shared
password. The trail can say *what* and *when*, never *who*.

**Why it is not a code decision.** It requires choosing how operators
authenticate, and the wrong choice on a shop taking live payments locks you out
of your own admin.

| Option | What it costs | What it buys |
|---|---|---|
| **Named logins in the database** — a small `admin_users` table, per-person password hash, the existing cookie session | One migration, a login rewrite, a way to add/remove people. You own the password reset problem. | Real attribution, revocable per person, no third party |
| **Keep one password, add an operator name at login** — a text field stored in the session and written to `admin_actions.actor` | Small. No migration beyond one column. | Attribution *by honesty*, not by proof. Useful with two trusted people; worthless against anyone dishonest |
| **SSO / an identity provider** | A dependency and a monthly cost; another external service that can fail (see B-30, B-31) | Real accounts without owning password reset |

**Recommendation: named logins in the database**, if more than one person will
ever touch `/admin`. If it is only ever you, option 2 is honest about what it is
and costs almost nothing — but it must be *described* as a label, never as
authentication.

**Would touch:** a migration (`admin_users`, `admin_actions.actor`),
`src/lib/admin-auth.ts`, `/api/admin/login`, the login form, and every
`recordAdminAction` call site. Roughly a day, and it needs a rollback plan that
survives a half-applied state — you must not be able to end up unable to log in.

**The question to answer:** will anyone other than you ever use `/admin`?

---

## OP-02 — engraving read-back before cutting

**The problem:** the engraved name is cut irreversibly. The workshop queue shows
it, but nothing requires the operator to *confirm they read it* before the piece
is made. B-34 fixed the customer's side (the engraving now survives "Buy now");
this is the bench side.

**Why it is not mine to impose.** It changes what you physically do before
cutting. A checkbox nobody asked for becomes a click people learn to dismiss,
which is L-5 — and a dismissed confirmation is worse than none, because it
*looks* like a control.

| Option | Trade-off |
|---|---|
| **Show it louder** — larger, isolated, unmissable in the queue | Zero friction, zero guarantee |
| **Type it back** — operator re-types the name to advance the order | Real verification, real friction on every order |
| **Tick to confirm** | Cheap; becomes reflex within a week |

**Recommendation: show it louder now**, and only add typing-back if a piece is
ever actually mis-cut. Do not buy friction before you have the failure.

**The question to answer:** has an engraving ever been cut wrong? If not, the
display change is the whole job.

---

## TR-03 — a production regression for the returned-order lifecycle

**The problem:** no automated test follows a real order through to `refunded`
against production.

**Why it is deliberately not automated.** Doing so means seeding and deleting
real rows in the live database on every CI run. Playbook **P-006** covers it
manually for exactly that reason. The tracker's status handling *is* covered by
unit tests (T-1, B-19), so what is missing is specifically the production
round-trip.

| Option | Trade-off |
|---|---|
| **Leave manual (P-006)** | No CI cost, no live-data risk, depends on someone running it |
| **Automate against production** | Real coverage; writes and deletes live rows every run, and a failed run leaves orphans |
| **A separate staging database** | Correct answer in the abstract; a second Supabase stack to run, pay for and keep in sync |

**Recommendation: leave it manual** until there is a staging database. The
automation is not the hard part — the place to run it safely is.

---

## #19 / #20 — blue-chip products, CJ intelligence layer

Commercial decisions, not defects. #19 is which products to stock; #20 is what
"intelligence" should mean and what it would be used for. Both predate this
engagement. Neither has a technical blocker — they need a brief.

---

## Also outstanding, and not code

- **Revoke the old Resend API key.** The replacement is proven delivering
  (`status=delivered`, verified end to end). The old key was exposed in session
  output and is still live until you revoke it.
- **Save the new key to `supabase.local`.** It was deliberately never seen from
  here — handling key values is the line that produced the leak in the first
  place.
