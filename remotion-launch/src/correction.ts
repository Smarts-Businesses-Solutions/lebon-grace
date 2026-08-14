/**
 * "The Correction" — Script A, as data.
 *
 * The device: a line appears, a rule draws itself through it, a truer line
 * replaces it. What makes it read as a person rather than a brand is that
 * every correction is **against our own interest**. "Made in a factory / Made
 * for one child" is a slogan answering a complaint nobody made aloud. "This
 * puzzle is in stock / It does not exist yet" is an admission, and admissions
 * get believed.
 *
 * All four corrections here are literally true of the shop:
 *
 *   in stock -> does not exist yet   nothing is held; every piece is cut to order
 *   same day -> we start cutting it  the 2-3 working days is make time, not post time
 *   costs extra -> it doesn't        details.personalisation: "free of charge"
 *   a machine made this -> helped    a laser cuts it; it is sanded and packed by hand
 *
 * This is the sibling of making.ts and shares its stock clips and its two
 * registers — footage full-bleed, our own product photography on brand paper.
 * Where "The Making" only ever states facts, this one argues, so the type is
 * Fraunces and it sits on a band rather than in a small corner slip.
 */

export const FPS = 30;

export type Correction =
  | {
      kind: "clip";
      src: string;
      frames: number;
      /** The statement beat: a line, struck through, replaced. */
      strike?: { before: string; after: string };
      /** A plain fact, for shots that carry no strike. Never both. */
      label?: string;
      drift?: "in" | "out";
    }
  | {
      kind: "plate";
      src: string;
      frames: number;
      strike?: { before: string; after: string };
      label?: string;
      /** The closing line, set plainly with no cancellation. */
      line?: string;
      zoom?: number;
      focus?: string;
      end?: boolean;
    };

/**
 * Twelve shots, 1830 frames, 61 seconds.
 *
 * Script A is 38s and nine shots. The three extra beats are the child playing,
 * the plain white version and a child colouring it in — the same addition made
 * to "The Making", and for the same reason: both films were all making and no
 * using.
 *
 * STATEMENT SHOTS ARE 240 FRAMES, and that is the voiceover's doing. Silent,
 * the device works in 150: the line appears, a rule crosses it at frame 42, the
 * replacement rises at 66. Spoken, it does not — the unhurried read takes 2.9s
 * for "A machine made this", so the replacement line began while the struck
 * line was still being said. Eight seconds gives the voice room to state
 * something, be heard, and then correct itself, which is the entire point of
 * the film. See STRIKE_* in CorrectionFilm.tsx for the matching animation.
 */
export const CORRECTION: Correction[] = [
  // ── 1. the admission ──────────────────────────────────────────────────────
  { kind: "clip", src: "stock/order.mp4", frames: 240, drift: "in",
    strike: { before: "This puzzle is in stock.", after: "It does not exist yet." } },

  // ── 2. the machine, and the name ──────────────────────────────────────────
  // Both generated on LTX-2.3 Fast at 1080p — the two shots free stock could
  // not provide. `cut` previously used a wood router standing in for a laser;
  // `name` previously used a static macro of our own product photograph.
  { kind: "clip", src: "stock/cut.mp4", frames: 90, label: "3mm MDF", drift: "in" },
  { kind: "clip", src: "stock/name.mp4", frames: 90, label: "AED 15", drift: "in" },

  // ── 3. what "same day" actually means ─────────────────────────────────────
  // `inspect`, not `lift`: this shot is now 8s and the lift clip is only 7.0s
  // of source. A Sequence longer than its video does not error, it holds the
  // last frame — a freeze nobody notices until it ships.
  { kind: "clip", src: "stock/inspect.mp4", frames: 240, drift: "out",
    strike: { before: "We ship it the same day.", after: "We start cutting it." } },

  { kind: "clip", src: "stock/sand.mp4", frames: 90, label: "Sanded by hand", drift: "in" },

  // ── 4. the free thing ─────────────────────────────────────────────────────
  { kind: "plate", src: "shots/alphabet-learning-board-0.png", frames: 240,
    strike: { before: "The engraving costs extra.", after: "It doesn't." } },

  { kind: "clip", src: "stock/pack.mp4", frames: 90, label: "Made to order in the United Arab Emirates", drift: "in" },

  // ── 5. what it is actually for ────────────────────────────────────────────
  // No type and no voice over these three. The film has argued four times by
  // now; the child using the thing is the evidence, and evidence does not need
  // a caption.
  { kind: "clip", src: "stock/play.mp4", frames: 120, label: "Ages 3–6", drift: "in" },
  { kind: "plate", src: "shots/abc-jigsaw-board-1.png", frames: 90, label: "Free collection" },
  { kind: "clip", src: "stock/colour.mp4", frames: 120, label: "UAE delivery · AED 20", drift: "out" },

  // ── 6. the honest one ─────────────────────────────────────────────────────
  { kind: "clip", src: "stock/sheet.mp4", frames: 240, drift: "out",
    strike: { before: "A machine made this.", after: "A machine helped." } },

  // ── 7. the close ──────────────────────────────────────────────────────────
  { kind: "plate", src: "shots/abc-jigsaw-board-0.png", frames: 180,
    line: "Nothing is made until you ask for it.", end: true },
];

export const CORRECTION_FRAMES = CORRECTION.reduce((n, s) => n + s.frames, 0);
