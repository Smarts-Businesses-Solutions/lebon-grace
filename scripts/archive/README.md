# Archived scripts

Nothing in here runs. It is kept because it records how the shop got to where it
is, and several of these were the only documentation of a decision at the time.

The problem being solved (finding A-1): `scripts/` and the repository root held
~50 loose files from four abandoned eras, and nothing distinguished them from the
handful that are load-bearing. A new maintainer had no way to tell which mattered,
so the safe assumption was "all of them" — which means none get touched.

**If you are looking for something that runs, it is not in this directory.**
See the table at the foot of this file.

## What is here, and why it stopped mattering

### `cj-dropship/`
The CJdropshipping and Tabbit era, when the catalogue was resold stock rather than
made-to-order pieces. Superseded by `scripts/catalog/04–07`, which generate the
catalogue from Postgres.

Several were already broken before being archived: `import-cj-variants.js`,
`import-tabbit-variants.js` and `safe-import.js` POST to `/api/import`, and
`proxy-image-urls.js` rewrites URLs to `/api/proxy-image` — both routes deleted in
A-9. `extract-cj-variants.js` and `scrape-cj-variants.js` read `data/cj-*.json`,
deleted in the same change.

CJ is not entirely gone: `products.cj_pid` / `cj_price` still exist and
`scripts/intel/` still uses them. `scripts/catalog/03-cj-enrich.mjs` was
deliberately **not** archived for that reason — it is re-runnable.

### `mdf-oneshots/`
Repeated attempts at the MDF range's images and dimensions — note the `-v2`
suffixes and four separate `fix-mdf-*` files, which is the shape of a problem
being solved by trial. The durable versions are `scripts/catalog/06-import-mdf.mjs`
(with a `sharp`-based blank-image guard) and `07-set-dimensions.mjs`.

### `ftp-deploy/`
Deployment by FTP upload and zip, before the estate existed. Now Coolify on
Hetzner cx53. These would not reach anything if run.

### `adhoc-verification/`
One-off "did the deploy work?" checks, written per incident and never reused.
`scripts/verify-deploy.mjs` is the durable replacement (A-5): it polls the live
site, compares the served `dpl=` build id, and exits non-zero when the deploy did
not land.

Note the sibling `_pw_*.py` files still in the repository root — those are
gitignored local scratch, not part of the repository at all.

### `hostinger/`
DNS and API glue from when the site was on Hostinger. `shop.lebon-grace.com` now
resolves through Cloudflare to Hetzner.

### `catalog-migration/`
Steps `01`, `02` and `02b` of the Postgres migration: extend the schema, move the
catalogue out of the TypeScript file, then backfill descriptions. Genuinely
one-shot — `02-migrate-from-ts.mjs` reads a source of truth that no longer exists,
because Postgres is now that source of truth.

## What actually runs

| Path | Purpose |
|---|---|
| `scripts/verify-deploy.mjs` | Confirm a deploy reached production (`npm run verify:deploy`). A-5. |
| `scripts/verify-migrations.sh` | Prove baseline + migrations reproduce production. A-8. |
| `scripts/catalog/03-cj-enrich.mjs` | Enrich catalogue rows from the CJ API. Re-runnable. |
| `scripts/catalog/04-generate-catalog.mjs` | Regenerate `src/lib/products.generated.ts` from Postgres. |
| `scripts/catalog/05-import-lasercut.mjs` | Import the laser-cut range. |
| `scripts/catalog/06-import-mdf.mjs` | Import the MDF range, with a blank-image guard. |
| `scripts/catalog/07-set-dimensions.mjs` | Apply measured dimensions. |
| `scripts/images/watermark.mjs` | Tiled anti-crop watermarking for product photography. |
| `scripts/intel/` | Nightly stock/price snapshots (`product_intel_snapshots`). |
| `scripts/sourcing/` | Sourcing agent — candidate search and review. |
| `scripts/stripe/preflight.mjs` | Ask Stripe whether the account can actually take a payment. |
| `scripts/stripe/upload-license.mjs` | Upload licensing documents to Stripe. |

## Recovering something

The files are still here, and git has every version regardless:

```bash
git log --follow -- scripts/archive/cj-dropship/safe-import.js
```

If one of these turns out to be needed again, move it back out and give it a
header saying what it is for — that absence is what put it in here.
