import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CuttingQueue } from "./OperationsDashboard";
import type { QueueEntry } from "@/lib/production-queue";

/**
 * The engraving is the one thing on this page that gets cut irreversibly (OP-02).
 *
 * Nothing has ever been mis-cut, which is exactly why this is a display change
 * and not a confirmation step: a tick-box nobody asked for becomes a reflex
 * click within a week (L-5), and a dismissed control is worse than no control
 * because it looks like one. So what is pinned here is legibility — the
 * engraving must be present, verbatim, and visually separated from the product
 * name it used to sit beside at 11px.
 *
 * Rendered with `react-dom/server` rather than a DOM harness: the project has no
 * jsdom or testing-library, and adding a browser-emulation stack to assert on
 * one block of markup buys nothing this does not.
 */

const entry = (items: QueueEntry["items"]): QueueEntry => ({
  id: "ord_1",
  shortId: "A1B2C3",
  customer: "Amina",
  status: "processing",
  placedAt: "2026-08-10T09:00:00Z",
  ageDays: 1,
  deliveryMethod: "delivery",
  emirate: "Dubai",
  engraved: items.some((i) => i.engraving),
  pieces: items.reduce((n, i) => n + i.quantity, 0),
  items,
});

const render = (items: QueueEntry["items"]) =>
  renderToStaticMarkup(<CuttingQueue queue={[entry(items)]} />);

describe("the engraving in the cutting queue", () => {
  it("shows the name exactly as the customer typed it", () => {
    // Accented and lookalike characters are the whole point: an operator who
    // reads "Zoe" for "Zoë" has already cut the wrong piece.
    const html = render([{ name: "Alphabet Board", quantity: 1, engraving: "Zoë" }]);
    expect(html).toContain("Zoë");
  });

  it("puts the engraving on its own row, not inline beside the product name", () => {
    // The B-34-era layout had both in one flex row, which is what made it
    // skimmable. If they ever share a row again this fails.
    const html = render([{ name: "Alphabet Board", quantity: 1, engraving: "Zoë" }]);
    const nameAt = html.indexOf("Alphabet Board");
    const engravingAt = html.indexOf("Zoë");
    expect(nameAt, "PRECONDITION: both are rendered").toBeGreaterThan(-1);
    expect(engravingAt).toBeGreaterThan(nameAt);
    // A closing div between them: they are siblings, not neighbours in one line.
    expect(html.slice(nameAt, engravingAt)).toContain("</div>");
  });

  it("labels it, so the text cannot be mistaken for part of the product name", () => {
    const html = render([{ name: "Alphabet Board", quantity: 1, engraving: "Zoë" }]);
    expect(html).toContain("Engrave");
  });

  it("renders it larger than the surrounding metadata", () => {
    // The specific regression this replaces: text-[11px], the same size as the
    // waiting-time and delivery chips it sat among.
    const html = render([{ name: "Alphabet Board", quantity: 1, engraving: "Zoë" }]);
    const block = html.slice(html.indexOf("Engrave"));
    expect(block).toContain("text-base");
    expect(block.slice(0, block.indexOf("Zoë"))).not.toContain("text-[11px]");
  });

  it("wraps a long name instead of clipping it", () => {
    // Clipping is the dangerous failure: the operator sees a complete-looking
    // name and cuts it, with no indication anything was cut off.
    const html = render([
      { name: "Alphabet Board", quantity: 1, engraving: "Muhammad Abdul Rahman Al Maktoum" },
    ]);
    expect(html).toContain("Muhammad Abdul Rahman Al Maktoum");
    expect(html).toContain("break-words");
  });

  it("PRECONDITION: a plain piece gets no engraving block at all", () => {
    // Without this, a component that rendered the block unconditionally — or
    // one that rendered nothing at all — would pass everything above.
    const html = render([{ name: "Alphabet Board", quantity: 1, engraving: null }]);
    expect(html).toContain("Alphabet Board");
    expect(html).not.toContain("Engrave");
  });

  it("escapes a name containing markup rather than rendering it", () => {
    // The engraving is customer-supplied text on an operator's screen. React
    // escapes it, and this is the guard that notices if that ever changes.
    const html = render([
      { name: "Alphabet Board", quantity: 1, engraving: "<script>alert(1)</script>" },
    ]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
