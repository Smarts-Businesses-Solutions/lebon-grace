-- Unlisted products: purchasable by direct URL, never shown in the shop.
--
-- WHY THIS IS NOT `hidden`. `hidden` means retired — the generator drops those
-- rows entirely, so a hidden product cannot be bought at all. What we need is
-- the opposite pairing: present in the catalogue and fully purchasable, but
-- absent from every listing, search result and sitemap.
--
-- The immediate use is an internal test item. The live shop takes payments and
-- the only way to prove the money path end to end is to actually buy something;
-- a cheap item that customers never see makes that repeatable after every
-- deploy rather than a one-off before launch.
--
-- Stripe refuses charges under AED 2.00, which is why the test item is priced
-- at 2 and not 1.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unlisted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN products.unlisted IS
  'Purchasable by direct URL but excluded from listings, search and sitemap. Not the same as hidden, which retires a product entirely.';

-- Partial index: the listing queries all filter on this, and virtually every
-- row is false, so indexing only the true rows keeps it small.
CREATE INDEX IF NOT EXISTS products_unlisted_idx ON products (unlisted) WHERE unlisted;

-- The test item itself.
--
-- hidden = false is deliberate and load-bearing: the generator drops hidden
-- rows, so marking this hidden would make it un-buyable, which is the one thing
-- it must be. `unlisted` is what keeps it out of the shop.
INSERT INTO products (slug, name, price, category, stock, image_url, description, hidden, unlisted, details)
VALUES (
  'internal-test-item',
  'Internal Test Item',
  2.00,
  'Clearance',
  999,
  '/images/products/placeholder.svg',
  'Internal use only. Used to verify that payment, the Stripe webhook, order creation, e-mail and the admin queue all still work on the live site. Not a real product; please do not order.',
  false,
  true,
  '{"dimensions":"100mm x 100mm","material":"n/a","made":"n/a"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE
  SET price = EXCLUDED.price,
      unlisted = true,
      hidden = false,
      updated_at = now();
