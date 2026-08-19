import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestCard } from "./DesignQueue";
import { OPERATOR_SETTABLE_STATUSES } from "@/lib/design-requests";

/**
 * This card is the only place in the shop that puts a customer's photograph on
 * a screen, and the signed URL that fetches it is a bearer credential: anyone
 * holding it can read the photograph with no session at all.
 *
 * So what is pinned here is the handling of that URL, not the layout. Rendered
 * with react-dom/server rather than a DOM harness, following the precedent in
 * OperationsDashboard.test.tsx — the project has no jsdom, and every property
 * worth asserting is visible in the markup.
 */

const SIGNED = "https://r2.example.test/pending/LG-ABC234/x.jpg?X-Amz-Signature=deadbeef";

// Typed rather than inferred: `artworkBytes: 204800` infers as `number`, so an
// override of `null` — the state this component has to handle — would not
// type-check against Partial<typeof request>.
const request: React.ComponentProps<typeof RequestCard>["request"] = {
  id: "row-1",
  reference: "LG-ABC234",
  createdAt: "2026-08-19T00:00:00Z",
  name: "Amira",
  email: "amira@example.test",
  phone: "+971 52 839 9804",
  brief: "our daughter's photo on a name puzzle",
  status: "submitted",
  hasArtwork: true,
  artworkBytes: 204800,
  note: null,
};

const render = (overrides: Partial<typeof request> = {}, viewingUrl: string | null = null) =>
  renderToStaticMarkup(
    <RequestCard
      request={{ ...request, ...overrides }}
      note=""
      busy={false}
      viewingUrl={viewingUrl}
      onNote={() => {}}
      onView={() => {}}
      onMove={() => {}}
      onCloseViewer={() => {}}
    />,
  );

describe("the artwork viewer", () => {
  it("puts the signed URL in an image, never in a link", () => {
    /*
     * An <a href> or a window.open writes the URL into browser history, where
     * it survives as a readable string long after its sixty seconds are up. An
     * image load does not. This is the whole reason the viewer renders inline
     * instead of opening a tab, so it is asserted rather than trusted.
     */
    const html = render({}, SIGNED);

    expect(html).toContain(`<img src="${SIGNED}"`);
    expect(html).not.toMatch(new RegExp(`<a [^>]*href="${SIGNED.replace(/[?.]/g, "\\$&")}"`));
  });

  it("does not put the URL anywhere a navigation could pick it up", () => {
    /*
     * The assertion above is deliberately about <a>, not about the string
     * "href", because React 19 hoists a <link rel="preload" as="image"> for
     * every <img> it renders ON THE SERVER (facebook/react#34217). That link
     * carries the same URL in an href.
     *
     * It cannot happen here: `viewingUrl` is null on every server render, since
     * it only becomes a string after the operator clicks a button in the
     * browser, and React does not emit the preload on the client. The test
     * renders through renderToStaticMarkup for want of a DOM, which is the one
     * place that path is reachable at all. Pinned so that if the viewer ever
     * moves somewhere server-rendered, this is a visible decision rather than a
     * silent one.
     */
    expect(render({}, null)).not.toContain("rel=\"preload\"");
  });

  it("suppresses the referrer, so the URL cannot leak to whatever it loads beside", () => {
    expect(render({}, SIGNED)).toContain('referrerPolicy="no-referrer"');
  });

  it("renders nothing of the URL until the operator asks for it", () => {
    // The card is rendered for every row in the queue. If a URL appeared here
    // without being asked for, opening the tab would mint a working key to
    // every open request at once.
    const html = render();
    expect(html).not.toContain("X-Amz-Signature");
    expect(html).not.toContain("<img");
  });
});

describe("what the card says about a request", () => {
  it("shows the reference, because that is what the customer will quote", () => {
    expect(render()).toContain("LG-ABC234");
  });

  it("offers exactly the statuses the API accepts, and no others", () => {
    /*
     * The orders side of this admin shipped a hand-copied status list that
     * silently lost `cancelled`. Both lists now come from one constant, and
     * this asserts the buttons really are built from it — a button offering
     * "ordered" or "expired" would 400 on click and look like a broken admin.
     */
    const html = render();
    for (const status of OPERATOR_SETTABLE_STATUSES) {
      expect(html).toContain(`>${status === "declined" ? "Decline" : status[0].toUpperCase() + status.slice(1)}<`);
    }
    for (const forbidden of ["Ordered", "Expired", "Submitted<"]) {
      expect(html).not.toContain(`>${forbidden}`);
    }
  });

  it("says so plainly when there is no artwork, rather than showing a dead button", () => {
    // A rejected upload still writes a row: that is what makes abuse visible.
    // The operator needs to see the request, not a View button that 404s.
    const html = render({ hasArtwork: false, artworkBytes: null });
    expect(html).toContain("No artwork on this request");
    expect(html).not.toContain("View artwork");
  });

  it("never renders the object key, only the fact that artwork exists", () => {
    // The queue API deliberately withholds the key so a caller cannot ask the
    // viewer for an arbitrary path in the bucket. The card must not reintroduce
    // it by rendering something the API never sent.
    expect(render()).not.toContain("pending/");
  });

  it("reaches the customer on WhatsApp with the digits only", () => {
    // wa.me rejects spaces and a leading plus. The number is stored as the
    // customer typed it, so the stripping happens here.
    expect(render()).toContain("https://wa.me/971528399804");
  });
});
