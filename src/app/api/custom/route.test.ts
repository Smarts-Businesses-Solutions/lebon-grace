import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The custom design endpoint is the shop's only unauthenticated route that
 * accepts a file. These tests assert the ORDER of its defences, because the
 * order is the design and a wrong order still returns 200.
 *
 * Everything with a side effect is mocked. What is under test is the route's
 * decision-making, not Postgres, R2 or Resend, each of which is covered where
 * it lives.
 */

const created = vi.fn();
const attached = vi.fn();
const put = vi.fn();
const delivered = vi.fn();
const throttleState = { blocked: false, retryAfterSeconds: 0, reason: null as string | null };

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => null,
  clientIp: () => "203.0.113.9",
}));

vi.mock("@/lib/design-request-throttle", () => ({
  checkSubmissionThrottle: async () => throttleState,
  throttledSubmissionResponse: () =>
    new Response(JSON.stringify({ error: "too many" }), { status: 429 }),
}));

vi.mock("@/lib/design-requests", () => ({
  createDesignRequest: async (input: unknown) => {
    created(input);
    return { id: "row-1", reference: "LG-ABC234" };
  },
  attachArtwork: async (...args: unknown[]) => void attached(...args),
}));

vi.mock("@/lib/artwork-storage", () => ({
  artworkKey: (ref: string) => `pending/${ref}/fixed.jpg`,
  putArtwork: async (...args: unknown[]) => void put(...args),
}));

vi.mock("@/lib/email", () => ({
  fromAddress: () => "shop@example.test",
  esc: (s: string) => s,
  deliver: async (...args: unknown[]) => void delivered(...args),
}));

vi.mock("@/lib/email-address", () => ({
  isDeliverableEmail: (e: string) => e.includes("@") && !e.endsWith("@nope.invalid"),
}));

vi.mock("@/lib/contact", () => ({ CONTACT: { email: "care@example.test" } }));

/*
 * The sanitiser is mocked, and that is deliberate.
 *
 * It has eleven tests of its own covering the hostile cases. Here it would only
 * make the route's ordering depend on whether a hand-built fixture happens to
 * decode. The first version of this file used a JPEG header followed by zeros
 * and got a correct 415, which looked like a route bug and was not.
 */
const sanitiseResult = {
  ok: true,
  buffer: Buffer.from("clean"),
  contentType: "image/jpeg",
  bytes: 5,
  width: 10,
  height: 10,
} as { ok: boolean; reason?: string; [k: string]: unknown };

vi.mock("@/lib/artwork", () => ({
  MAX_ARTWORK_BYTES: 10 * 1024 * 1024,
  REJECTION_MESSAGE: { "not-an-image": "not an image", "too-large": "too large" },
  sanitiseArtwork: async () => sanitiseResult,
}));

const { POST } = await import("./route");

const submit = (fields: Record<string, string>, file?: File) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) form.append("artwork", file);
  return POST({
    formData: async () => form,
    headers: new Headers(),
  } as never);
};

const jpeg = (bytes = 1024) =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(bytes).fill(0)])], "a.jpg", {
    type: "image/jpeg",
  });

const VALID = { name: "Amira", email: "a@example.test", brief: "Her name on a boat board" };

beforeEach(() => {
  vi.clearAllMocks();
  throttleState.blocked = false;
  sanitiseResult.ok = true;
  delete sanitiseResult.reason;
});

describe("POST /api/custom", () => {
  it("stores a row, then artwork, then tells the operator", async () => {
    const res = await submit(VALID, jpeg());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reference).toBe("LG-ABC234");
    expect(created).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledOnce();
    expect(attached).toHaveBeenCalledOnce();
    expect(delivered).toHaveBeenCalledOnce();
  });

  it("records the submitter address, or the throttle counts nothing", async () => {
    // This is the bug that was caught before shipping: a throttle querying a
    // column nobody writes reports itself working while bounding nothing.
    await submit(VALID, jpeg());
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ submitterIp: "203.0.113.9" }));
  });

  it("answers a honeypot submission with 200 and writes nothing", async () => {
    const res = await submit({ ...VALID, website: "http://spam.test" }, jpeg());
    expect(res.status).toBe(200);
    expect(created).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("refuses an unreachable email before creating anything", async () => {
    const res = await submit({ ...VALID, email: "nobody@nope.invalid" }, jpeg());
    expect(res.status).toBe(400);
    expect(created).not.toHaveBeenCalled();
  });

  it("requires artwork", async () => {
    const res = await submit(VALID);
    expect(res.status).toBe(400);
    expect(created).not.toHaveBeenCalled();
  });

  it("requires name, email and brief", async () => {
    const res = await submit({ name: "", email: "", brief: "" }, jpeg());
    expect(res.status).toBe(400);
    expect(created).not.toHaveBeenCalled();
  });

  it("refuses when the database throttle says so, before touching storage", async () => {
    throttleState.blocked = true;
    const res = await submit(VALID, jpeg());
    expect(res.status).toBe(429);
    expect(created).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("keeps the row when the file is rejected, so a flood stays visible", async () => {
    /*
     * The deliberate ordering. Without the row, an attacker sending hundreds of
     * malformed files leaves no trace and the throttle has nothing to count.
     */
    sanitiseResult.ok = false;
    sanitiseResult.reason = "not-an-image";

    const res = await submit(VALID, jpeg());
    const body = await res.json();

    expect(res.status).toBe(415);
    expect(created).toHaveBeenCalledOnce();
    expect(body.reference).toBe("LG-ABC234");
    // Nothing reached storage, and the row holds no key.
    expect(put).not.toHaveBeenCalled();
    expect(attached).not.toHaveBeenCalled();
  });

  it("never sends the artwork itself to the operator's mailbox", async () => {
    await submit(VALID, jpeg());
    const payload = delivered.mock.calls[0]?.[1] as { html: string; attachments?: unknown };
    expect(payload.attachments).toBeUndefined();
    expect(payload.html).not.toContain("base64");
  });
});
