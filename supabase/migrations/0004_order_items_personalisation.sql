-- 0004 — store the engraved name as its own field
--
-- ACTION_PLAN.md A-15. The workshop queue has to show what to engrave, and the
-- engraved name was only ever stored inside the display string:
--
--     product_name = 'ABC Jigsaw Board (engraved: Amira)'
--
-- built by src/app/api/stripe-webhook/route.ts. Reading it back means parsing
-- that sentence. Every other field a workshop needs is structured; this one, the
-- one that gets cut irreversibly into a piece of wood, was not.
--
-- The failure mode is quiet and expensive: change the wording, or engrave a name
-- containing a bracket, and the parse yields the wrong string or nothing at all.
-- Nobody finds out until a customer opens a parcel with someone else's child's
-- name on it, and the piece cannot be un-cut.
--
-- `product_name` deliberately keeps the "(engraved: …)" suffix — it is what
-- appears on the Stripe receipt and in the order listing, and reads naturally
-- there. This column is the structured copy the workshop reads.
--
-- No backfill: `order_items` currently holds 0 rows (audited 2026-08-08), so
-- there is no historical parsing to do. Should rows predate this column, they
-- keep NULL and the dashboard falls back to parsing the name for them.
--
-- Nullable on purpose: most pieces are not engraved, and NULL says "no
-- engraving" more honestly than an empty string.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS personalisation text;

-- Matches the cap the checkout route already enforces
-- (src/app/api/checkout/route.ts:64, `.trim().slice(0, 20)`). Stated here too
-- because the client is not a security boundary and this string ends up cut
-- into a product.
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_personalisation_len;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_personalisation_len
  CHECK (personalisation IS NULL OR char_length(personalisation) <= 20);

-- Rollback:
--     ALTER TABLE public.order_items DROP CONSTRAINT order_items_personalisation_len;
--     ALTER TABLE public.order_items DROP COLUMN personalisation;
