-- 0005 — real reviews, so honest social proof can come back
--
-- ACTION_PLAN.md A-18. src/app/page.tsx:9-25 records why there are no ratings
-- on this shop today: the version it replaced derived them from the product's
-- array index —
--
--     const rating = 3.5 + (index % 3) * 0.5;
--     const reviewCount = (index * 7 + 12) % 50 + 5;
--
-- — while not one review existed and the shop had never taken an order. That
-- comment ends "when there are genuine reviews, they can go back in reading from
-- a reviews table". This is that table.
--
-- The acceptance criterion is "ratings shown are backed by a real order", so the
-- link to an order is a FOREIGN KEY, not a convention a future edit can forget.
-- A review row cannot exist without an order row, and deleting the order takes
-- the review with it.
--
-- What the database cannot express, and is therefore enforced in
-- src/app/api/reviews/route.ts, is that the order actually CONTAINED this
-- product and has actually been delivered. Both are checked before insert.
--
-- Invented ratings carry real exposure under UAE Federal Law No. 15 of 2020 on
-- Consumer Protection, which is the reason the fake ones were removed rather
-- than merely tidied.

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The whole point. ON DELETE CASCADE because a review of an order that no
  -- longer exists is exactly the orphaned social proof this table exists to
  -- prevent.
  order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_slug  text NOT NULL,

  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  -- Capped rather than unbounded: this is displayed on a public page.
  comment       text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  -- Display name only. Never the email or phone — those are the credential used
  -- to authenticate the review, and must not become public.
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 80),

  created_at    timestamptz NOT NULL DEFAULT now(),

  -- One review per piece per order. Without this, a single delivered order
  -- could be replayed into unlimited five-star reviews — the same dishonesty as
  -- the index-derived ratings, just with more steps.
  UNIQUE (order_id, product_slug)
);

-- Reviews are read per product page.
CREATE INDEX IF NOT EXISTS product_reviews_slug_idx
  ON public.product_reviews (product_slug, created_at DESC);

-- Deny by default. The application reads and writes through the service role
-- (src/lib/store.ts), which bypasses RLS; the anon key is published to browsers
-- by definition, so it gets no policy at all. This is the posture 0001
-- established for public.products after the permissive write policy was found.
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Rollback:
--     DROP TABLE public.product_reviews;
