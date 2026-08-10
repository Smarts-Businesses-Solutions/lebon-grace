import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `SENTRY_DEBUG` exists to answer one question without needing GlitchTip access:
 * **did this event actually leave the server, and was it accepted?**
 *
 * Everything either side of that hop is already proven — the app emits an
 * envelope (scripts/prove-sentry-init.mjs) and GlitchTip accepts envelopes from
 * the production container. The join between them was the last inference in
 * B-31, and inferences at untested seams are what this whole engagement kept
 * tripping over.
 *
 * It is deliberately an env var, not a build flag: flipping it needs a container
 * recreate, not a rebuild, and it is read at runtime because non-`NEXT_PUBLIC_`
 * variables are never inlined by Next.
 */

const init = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({
  init,
  captureConsoleIntegration: vi.fn(() => ({ name: "CaptureConsole" })),
  makeNodeTransport: vi.fn(() => ({ send: vi.fn(), flush: vi.fn() })),
}));

/** The options object the config passed to Sentry.init. */
async function initOptions(): Promise<Record<string, unknown>> {
  await import("../sentry.server.config");
  return init.mock.calls[0][0] as Record<string, unknown>;
}

describe("SENTRY_DEBUG", () => {
  beforeEach(() => {
    vi.resetModules();
    init.mockClear();
    delete process.env.SENTRY_DEBUG;
  });

  it("is OFF unless explicitly switched on", async () => {
    // Debug logging is verbose and goes to stdout on every event. Anything other
    // than a deliberate "1" must leave production quiet.
    expect((await initOptions()).debug).toBe(false);
  });

  it("turns on for SENTRY_DEBUG=1", async () => {
    process.env.SENTRY_DEBUG = "1";
    expect((await initOptions()).debug).toBe(true);
  });

  it("ignores every other value, including 'true'", async () => {
    // A half-set variable — "0", "false", "" — must not silently enable it.
    // "true" is rejected on purpose: one spelling, so the runbook cannot drift
    // from the code.
    for (const v of ["0", "false", "", "true", "yes"]) {
      vi.resetModules();
      init.mockClear();
      process.env.SENTRY_DEBUG = v;
      expect((await initOptions()).debug, `SENTRY_DEBUG=${JSON.stringify(v)}`).toBe(false);
    }
  });

  it("PRECONDITION: the rest of the config is still there", async () => {
    // Without this, a config that failed to load at all would satisfy every
    // assertion above by returning undefined for everything.
    const opts = await initOptions();
    expect(opts.sampleRate).toBe(1.0);
    expect(Array.isArray(opts.integrations)).toBe(true);
  });
});
