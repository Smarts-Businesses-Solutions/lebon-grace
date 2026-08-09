import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

/**
 * Route modules must be IMPORTABLE without any runtime secrets.
 *
 * Written before the fix, from a failure the Forgejo CI gate caught on its very
 * first full run — `next build` died with:
 *
 *     Failed to collect configuration for /api/cart-recovery
 *       [cause]: Missing API key. Pass it to the constructor `new Resend("re_123")`
 *
 * Next evaluates every route module during the build to collect its config, so
 * a module-scope `new Resend(process.env.RESEND_API_KEY)` turns a missing
 * environment variable into a BUILD failure rather than a request failure. The
 * build then depends on production secrets, which is why it worked in Docker
 * (build-apps.sh passes placeholders) and nowhere else.
 *
 * That gotcha was already known — FOR-EVARISTE.md line 209 says builds "need
 * placeholder env values". This test exists to stop that being true. Passing
 * placeholders is a workaround that has to be repeated in every new build
 * context forever, and is silently forgotten in each one until a build breaks.
 *
 * NOTE: this file deliberately does NOT `vi.mock("resend")`. `email.test.ts`
 * does, which is exactly why the whole unit suite stayed green while the build
 * was broken — a mock is registered before resolution, so the real constructor
 * never ran. The bug lived in the gap between "unit tests pass" and "it builds".
 */

const SECRETS = [
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const saved: Record<string, string | undefined> = {};
for (const k of SECRETS) saved[k] = process.env[k];

beforeEach(() => {
  // The state a fresh CI runner is in: no secrets at all. Not placeholders —
  // absent. Absent and placeholder are different, and only one of them was
  // ever tested.
  for (const k of SECRETS) delete process.env[k];
  vi.resetModules();
});

afterAll(() => {
  for (const k of SECRETS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("modules import cleanly with no environment at all", () => {
  // The two routes named in the build failure, plus the shared email module
  // they were pulling the same pattern from.
  const modules = [
    ["@/lib/email", "the shared email module"],
    ["@/app/api/contact/route", "/api/contact — named in the build failure"],
    ["@/app/api/cart-recovery/route", "/api/cart-recovery — named in the build failure"],
  ] as const;

  for (const [specifier, why] of modules) {
    it(`imports ${specifier} without throwing (${why})`, async () => {
      await expect(import(/* @vite-ignore */ specifier)).resolves.toBeDefined();
    });
  }
});
