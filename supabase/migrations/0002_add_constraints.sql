-- 0002 — make invalid states unrepresentable, rather than merely unwritten
--
-- Findings D-1 and D-2. `orders.status` was free text and no business table had
-- a single CHECK constraint (the only CHECK in the baseline dump belongs to
-- Supabase's own auth.users). Both invariants were held by convention alone.
--
-- Why it matters more than it looks: an order whose status is not one the UI
-- knows disappears. src/app/track/TrackClient.tsx:88 resolves the timeline with
-- `STATUS_INDEX[order.status] ?? -1`, so an unrecognised status lights no step —
-- the customer sees a tracking page where nothing has happened. And
-- src/components/OperationsDashboard.tsx:152 renders only the PIPELINE_STAGES
-- keys, so the order appears in no column of the production queue. Nobody cuts
-- the puzzle, and nothing raises an alarm, until the customer asks where it is.
--
-- Audited before writing (2026-08-08, live): 1 order, 0 order_items,
-- 610 products, 5066 product_variants. Zero rows violate anything below, so
-- every constraint applies without a rewrite. Row counts are small enough that
-- the brief ACCESS EXCLUSIVE lock each ALTER takes is not worth deferring with
-- NOT VALID / VALIDATE.
--
-- Each constraint is dropped first so this file is safe to re-run.

-- ── orders.status ──────────────────────────────────────────────────────────
-- The permitted set is the UNION of every value any code path can write, not
-- the tidier set anyone would design today:
--
--   deposit_paid      DB default; the first stage every view keys off
--   processing/shipped/out_for_delivery/delivered/completed/failed/refunded
--                     the admin dropdown, src/app/admin/page.tsx:16-19
--   cancelled         not in the dropdown, but has full email and WhatsApp
--                     copy (src/lib/email.ts:53, src/lib/whatsapp.ts:49) and a
--                     branch in TrackClient — a reachable state, so allowed
--   paid              TRANSITIONAL — see below
--
-- `paid` is what src/app/api/stripe-webhook/route.ts writes on every new order,
-- and it is in NONE of the sets the rest of the app filters on: not in
-- STATUS_INDEX, not in PIPELINE_STAGES, not in the admin dropdown, not in the
-- metrics buckets. It is a drift left behind when the 50% deposit model was
-- removed. The webhook is being corrected to write `deposit_paid` instead.
--
-- It is nonetheless permitted HERE, deliberately. Production is still serving
-- the 2026-08-07 build, which writes `paid`. A constraint that rejected it
-- would not surface a bug — it would make every INSERT from the live webhook
-- fail, so customers would be charged by Stripe and no order would be recorded.
-- Drop it in a follow-up migration once the corrected webhook is deployed AND
-- no rows remain with it:
--     UPDATE public.orders SET status = 'deposit_paid' WHERE status = 'paid';
--     ALTER TABLE public.orders DROP CONSTRAINT orders_status_valid;
--     ALTER TABLE public.orders ADD  CONSTRAINT orders_status_valid
--       CHECK (status IN (... the same list without 'paid' ...));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_valid;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_valid CHECK (
  status IN (
    'deposit_paid',
    'paid',              -- transitional, see above
    'processing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled',
    'failed',
    'refunded'
  )
);

-- A CHECK is not violated by NULL — the expression evaluates to unknown, which
-- passes. Without this, an explicit NULL would slip straight through the list
-- above and produce exactly the invisible order the constraint exists to stop.
-- The column already has DEFAULT 'deposit_paid' and no NULL rows.
ALTER TABLE public.orders ALTER COLUMN status SET NOT NULL;

-- ── money and quantities ───────────────────────────────────────────────────
-- A negative price is not a rounding error, it is a refund the shop did not
-- authorise: src/app/api/checkout/route.ts:119 turns the catalogue price into
-- the Stripe line item with `Math.round(item.price * 100)`, so a negative
-- catalogue row would be sent to Stripe as a negative unit_amount.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_amounts_non_negative;
ALTER TABLE public.orders ADD CONSTRAINT orders_amounts_non_negative CHECK (
  subtotal >= 0 AND total >= 0 AND deposit_amount >= 0
  AND cod_amount >= 0 AND (shipping IS NULL OR shipping >= 0)
);

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_price_non_negative;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_price_non_negative
  CHECK (price >= 0);

-- Zero is as wrong as negative here: a line item nobody ordered. The checkout
-- route already rejects it (route.ts:57-60); this is the same rule at the level
-- that cannot be bypassed.
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_quantity_positive;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantity_positive
  CHECK (quantity >= 1);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_price_non_negative;
ALTER TABLE public.products ADD CONSTRAINT products_price_non_negative
  CHECK (price >= 0);

-- Nullable with DEFAULT 50; the CHECK constrains the value when there is one.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_stock_non_negative;
ALTER TABLE public.products ADD CONSTRAINT products_stock_non_negative
  CHECK (stock IS NULL OR stock >= 0);

ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_price_non_negative;
ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_price_non_negative
  CHECK (variant_price IS NULL OR variant_price >= 0);

-- Rollback, in full:
--     ALTER TABLE public.orders           DROP CONSTRAINT orders_status_valid;
--     ALTER TABLE public.orders           ALTER COLUMN status DROP NOT NULL;
--     ALTER TABLE public.orders           DROP CONSTRAINT orders_amounts_non_negative;
--     ALTER TABLE public.order_items      DROP CONSTRAINT order_items_price_non_negative;
--     ALTER TABLE public.order_items      DROP CONSTRAINT order_items_quantity_positive;
--     ALTER TABLE public.products         DROP CONSTRAINT products_price_non_negative;
--     ALTER TABLE public.products         DROP CONSTRAINT products_stock_non_negative;
--     ALTER TABLE public.product_variants DROP CONSTRAINT product_variants_price_non_negative;
