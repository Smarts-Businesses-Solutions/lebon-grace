/**
 * "The Making" — the second launch film, as data.
 *
 * Where the first film argues (a line is struck through and corrected), this
 * one only shows and states. The reference it is built against is persuasive
 * because every number on screen is real: it never says "beautiful" or
 * "premium", it shows the work and lets you conclude. So every caption here is
 * a fact checked against the shop itself, not a claim written for the film:
 *
 *   "3mm MDF"          src/lib/parcel.ts — sheet stock is 3mm; the finished
 *                      piece is 6mm, two bonded layers. The caption sits on the
 *                      sheet shot, so 3mm is the correct number for it.
 *   "Name engraved · free"  homepage: "Name engraved free"
 *   "Sanded by hand"   about: "We cut, sand and finish"
 *   "AED 15"           41 of 41 publicly listed products are AED 15
 *   "Made to order in Dubai"  homepage: "Cut to order · Dubai workshop"
 *   "Ready in 2–3 working days"  repeated across faq/cart/checkout/terms
 *
 * If one of those stops being true, the film stops being usable. That is the
 * correct trade, and it is why the captions name no city the site does not
 * already name and make no promise the shop does not already make.
 *
 * TWO REGISTERS, ON PURPOSE. Stock clips play full-bleed; Lebon Grace's own
 * product photographs sit on brand paper like catalogue plates. That is a
 * design rhythm, but it is also an honesty device: the footage of a workshop is
 * somebody else's workshop, and it never carries a caption claiming otherwise.
 * Both stock licences forbid deceptive use, so the type talks about the product
 * — which is ours — and never about the room on screen.
 */

export const FPS = 30;

export type Making =
  | {
      kind: "clip";
      /** File under public/stock/. */
      src: string;
      frames: number;
      /** Small factual caption, lower-left. Omitted where the shot should run. */
      label?: string;
      /** Gentle drift so a 4s clip does not feel locked off. */
      drift?: "in" | "out";
    }
  | {
      kind: "plate";
      /** File under public/shots/ — Lebon Grace's own photography. */
      src: string;
      frames: number;
      label?: string;
      /** Start scale. >1 crops in for a macro of the engraving. */
      zoom?: number;
      /** Centre of the crop, as CSS object-position. */
      focus?: string;
      /** The closing plate carries the wordmark. */
      end?: boolean;
    };

/**
 * Twelve shots, 1560 frames, exactly 52 seconds.
 *
 * The doorstep shot the script asked for is missing, and deliberately so. Every
 * free doorstep clip found carried either Amazon branding or an unflattering
 * shot of a person, both barred by the stock licences. Closing on the real
 * product instead is truer and costs the film nothing.
 *
 * The first cut ran 42s and ended at "packed" — it showed the object being
 * made and never once showed it being used. The three beats added after "AED
 * 15" fix that: a child's hands on the puzzle, the plain white version, and a
 * child colouring one in.
 */
export const MAKING: Making[] = [
  { kind: "clip",  src: "stock/order.mp4", frames: 120, label: "Order received", drift: "in" },
  { kind: "clip",  src: "stock/sheet.mp4", frames: 105, label: "3mm MDF · one sheet", drift: "out" },

  // The machine, working. No caption — this is the shot people watch.
  { kind: "clip",  src: "stock/cut.mp4",   frames: 135, drift: "in" },

  // The name, being engraved. Generated on LTX-2.3 Fast, because this shot does
  // not exist in free stock: 104 candidates were searched and every one was
  // industrial metal, a laser light show, or a bonfire.
  //
  // It replaces a macro push into our own product photograph. That plate was
  // true but static, and the script always wanted the letters ARRIVING — the
  // whole point of the shot is that the name is made, not that it exists.
  //
  // Of three takes only this one produced real letters ("LUCY"); the other two
  // rendered convincing-looking gibberish, which is what generative models do
  // to text and why more than one take was budgeted.
  { kind: "clip", src: "stock/name.mp4", frames: 165, label: "Engraving · free", drift: "in" },

  { kind: "clip",  src: "stock/lift.mp4",  frames: 105, drift: "out" },
  { kind: "clip",  src: "stock/sand.mp4",  frames: 135, label: "Sanded by hand", drift: "in" },

  { kind: "plate", src: "shots/alphabet-learning-board-0.png", frames: 120, label: "AED 15" },

  // ── what it is for ────────────────────────────────────────────────────────
  // The film spends its first half on how the thing is made and, until here,
  // never showed anybody using it. A child's hands on the puzzle is the point
  // of the whole object.
  //
  // "Ages 3-6" is the catalogue's own `details.age` field, on every product.
  { kind: "clip",  src: "stock/play.mp4",  frames: 135, label: "Ages 3–6", drift: "in" },

  // The plain white version, and a child colouring one in.
  //
  // NO CAPTION on either beat, deliberately. Every product's photo set
  // includes this white colour-in variant, so it is already on the listing —
  // but no copy anywhere on the site describes it, names it, or says whether
  // crayons are included. Captioning it would put a claim in the film that the
  // shop does not make, which is the one thing this film is built not to do.
  // Add the caption once the site says it.
  { kind: "plate", src: "shots/abc-jigsaw-board-1.png", frames: 120 },
  { kind: "clip",  src: "stock/colour.mp4", frames: 135, drift: "out" },

  // "in the United Arab Emirates", not "in Dubai". The site says "Dubai
  // workshop" while the company is registered in Sharjah; naming the country
  // is true under either reading and does not have to be re-cut if the
  // workshop moves between emirates.
  { kind: "clip",  src: "stock/pack.mp4",  frames: 120,
    label: "Made to order in the United Arab Emirates", drift: "in" },

  // Closes on the whole of the board whose engraving opened in macro at shot 4.
  //
  // Every product has three photographs and only the "-0" is usable here: the
  // "-1" and "-2" variants are the white-painted version styled with a row of
  // rainbow crayons, and several "-2" files carry a baked-in dimension label
  // ("196mm x 149mm") burnt into the pixels. This closed on a "-2" in the first
  // render and ended the film on what looked like a spec sheet.
  { kind: "plate", src: "shots/abc-jigsaw-board-0.png", frames: 165,
    label: "Ready in 2–3 working days", end: true },
];

export const MAKING_FRAMES = MAKING.reduce((n, s) => n + s.frames, 0);
