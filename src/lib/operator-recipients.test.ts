import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type SendPayload = { from: string; to: string[]; subject: string; html: string };
const send = vi.fn(async (_p: SendPayload) => ({ data: { id: "msg_1" }, error: null }));
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));

import { sendOperatorNotice, sendOperatorOrderAlert } from "./email";

/**
 * Every operator must be told, not just one mailbox.
 *
 * Operator alerts went to a single address — ORDER_NOTIFY_EMAIL, falling back
 * to CONTACT_EMAIL. With two named operators running the shop that means one
 * of them learns about a new order and the other does not, and which one
 * depends on an environment variable nobody looks at.
 *
 * Recipients are therefore derived from ADMIN_USERS: the people who can
 * actually sign in to /admin. Add an operator and they start receiving alerts;
 * remove one and they stop. No second list to forget to update.
 */

const A = "wanresionne@gmail.com";
const B = "smarts.businesses.solutions@gmail.com";

/** ADMIN_USERS entries only need a parseable shape here; the hash is not checked. */
const ADMIN_USERS = `${A}:aaaa$bbbb,${B}:cccc$dddd`;

const order = {
  id: "ord_test", customer_name: "Buyer", customer_email: "buyer@example.com",
  customer_phone: "+971500000000", total: 2, deposit_amount: 2, cod_amount: 0,
  status: "deposit_paid", created_at: new Date().toISOString(),
};

function recipients(): string[] {
  expect(send).toHaveBeenCalled();
  const last = send.mock.calls.at(-1);
  if (!last) throw new Error("resend send was never called");
  return last[0].to;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  process.env.MAIL_FROM_ADDRESS = "orders@lebon-grace.com";
  process.env.ADMIN_USERS = ADMIN_USERS;
  process.env.ORDER_NOTIFY_EMAIL = "care@lebon-grace.com";
});
afterEach(() => { delete process.env.ADMIN_USERS; delete process.env.ORDER_NOTIFY_EMAIL; });

describe("operator alerts reach every operator", () => {
  it("tells BOTH named operators about a new order", async () => {
    await sendOperatorOrderAlert(order as never, []);
    const to = recipients();
    expect(to).toContain(A);
    expect(to).toContain(B);
  });

  it("still includes the shared operations mailbox", async () => {
    // The named operators are people; care@ is the address on the website and
    // may be watched by someone who never signs in to /admin.
    await sendOperatorOrderAlert(order as never, []);
    expect(recipients()).toContain("care@lebon-grace.com");
  });

  it("applies to general operator notices too, not just order alerts", async () => {
    // sendOperatorNotice carries the ones that matter most — "paid order with
    // nothing to make". Fixing only the order alert would leave the alarm
    // going to one person.
    await sendOperatorNotice("Something needs attention", "<p>x</p>");
    const to = recipients();
    expect(to).toContain(A);
    expect(to).toContain(B);
  });

  it("sends no duplicates when an operator is also the notify address", async () => {
    process.env.ORDER_NOTIFY_EMAIL = A;
    await sendOperatorOrderAlert(order as never, []);
    const to = recipients();
    expect(to.filter((x) => x.toLowerCase() === A).length).toBe(1);
  });

  it("still works with no named operators — falls back to the mailbox", async () => {
    // Before AD-02 there were none, and a shop with ADMIN_USERS unset must not
    // silently stop telling anyone about orders.
    delete process.env.ADMIN_USERS;
    await sendOperatorOrderAlert(order as never, []);
    expect(recipients()).toEqual(["care@lebon-grace.com"]);
  });

  // There is deliberately NO "nobody to tell" test: CONTACT.email falls back to
  // a hardcoded "care@lebon-grace.com", so a recipient always exists. Asserting
  // otherwise would be testing a state the code cannot reach.
});
