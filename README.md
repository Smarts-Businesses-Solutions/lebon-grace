This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy

Self-hosted. Not Vercel, not Supabase cloud, not Hostinger.

The app runs as a Docker container on the machine described in
`aprojects/ops/selfhost/`, behind Caddy over an SSH reverse tunnel, and stores
orders in a self-hosted Postgres reached through PostgREST. Analytics go to a
self-hosted PostHog and errors to GlitchTip.

```bash
# Build and (re)deploy the container
aprojects/ops/selfhost/scripts/build-apps.sh lebon-grace

# Unit tests (geometry, validators)
npm test

# Stripe go-live readiness, read-only
node scripts/stripe/preflight.mjs
```

Environment is supplied at runtime from
`aprojects/ops/selfhost/apps/lebon-grace.runtime.env`. `APP_URL` is read on every
request, so the public domain can change with a restart rather than a rebuild.

An earlier README revision described a Hostinger deploy backed by a local JSON
store at `.data/store.json`. That was true for about a week in July 2026 and is
not how anything works now: the JSON store was replaced by Postgres and the
Hostinger move was abandoned.
