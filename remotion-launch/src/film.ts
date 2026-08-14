/**
 * The launch film, as data.
 *
 * Shot rhythm is taken from the reference the brief was built against: 69 cuts
 * in 106 seconds, average 1.48s, median 1.29s. Fast, rhythmic, never dwelling.
 * So the default shot here is 45 frames at 30fps — 1.5s — with the statement
 * beats held longer because they carry words.
 *
 * The device is the reference's, and the register matters more than the
 * structure. The reference opens "We recently hired a new teammate" with the
 * last three words struck out — someone talking, catching themselves, and the
 * correction revealing something odder than you expected.
 *
 * The first draft here missed that. It used the strikethrough as
 * objection-and-rebuttal — "Made in a factory / Made for one child" — which is
 * advertising voice: a slogan answering a complaint nobody made out loud.
 *
 * These lines are the shop admitting things instead. That the puzzle does not
 * exist yet. That "same day" means cutting, not shipping. That a machine is
 * involved and pretending otherwise would be a lie. Each correction is true and
 * slightly against interest, which is why it reads as a person rather than a
 * brand.
 */

export const FPS = 30;

/** A photograph on screen, with a slow move across it. */
export type Shot = {
  /** File under public/shots/. */
  src: string;
  /** Frames on screen. */
  frames: number;
  /** Ken Burns direction — the move is always slow enough to feel like a hold. */
  motion: "in" | "out" | "left" | "right";
  /** Statement beat: the line that gets struck through, then its replacement. */
  strike?: { before: string; after: string };
  /** A plain line with no strikethrough. */
  line?: string;
};

const S = (src: string, frames: number, motion: Shot["motion"], extra: Partial<Shot> = {}): Shot => ({
  src, frames, motion, ...extra,
});

/**
 * Five movements.
 *
 * 1. the objection, answered      — why this exists
 * 2. the making                   — what it is
 * 3. the three real objections    — warehouse, assembly, waiting
 * 4. the range, fast              — there is a lot of it
 * 5. the close                    — where to go
 */
export const SHOTS: Shot[] = [
  // ── 1. the objection ──────────────────────────────────────────────────────
  S("shots/abc-jigsaw-board-0.png", 150, "in", {
    strike: { before: "This puzzle is in stock.", after: "It does not exist yet." },
  }),

  // ── 2. the making ─────────────────────────────────────────────────────────
  S("shots/alphabet-learning-board-0.png", 45, "left"),
  S("shots/bear-alphabet-puzzle-0.png", 45, "in"),
  S("shots/alphabet-snail-puzzle-0.png", 40, "right"),
  S("shots/colour-me-dinosaur-alphabet-puzzle-0.png", 45, "out"),
  S("shots/alphabet-fish-puzzle-0.png", 40, "in"),
  S("shots/abc-jigsaw-board-1.png", 50, "left", { line: "We cut it, sand it, and put her name on it." }),
  S("shots/alphabet-car-puzzle-0.png", 45, "in"),
  S("shots/elephant-number-puzzle-0.png", 40, "right"),
  S("shots/giraffe-number-puzzle-0.png", 45, "in"),

  // ── 3. the three objections ───────────────────────────────────────────────
  S("shots/count-and-match-number-board-0.png", 135, "in", {
    strike: { before: "We ship it the same day.", after: "We start cutting it." },
  }),
  S("shots/owl-number-tower-puzzle-0.png", 45, "left"),
  S("shots/rocket-number-puzzle-0.png", 40, "in"),
  S("shots/shape-peg-board-0.png", 45, "right"),

  S("shots/montessori-3d-layer-puzzle-0.png", 135, "in", {
    strike: { before: "Her name costs extra.", after: "Her name is free." },
  }),
  S("shots/teddy-bear-layer-board-0.png", 45, "out"),
  S("shots/heart-tangram-nine-pieces-0.png", 40, "in"),
  S("shots/solar-system-peg-puzzle-0.png", 45, "left"),

  S("shots/stacking-animal-friends-3d-0.png", 135, "in", {
    strike: { before: "A machine made this.", after: "A machine helped." },
  }),

  // ── 4. the range, fast ────────────────────────────────────────────────────
  S("shots/excavator-puzzle-0.png", 30, "in"),
  S("shots/cement-mixer-shape-puzzle-0.png", 30, "left"),
  S("shots/alphabet-car-puzzle-1.png", 30, "right"),
  S("shots/bear-alphabet-puzzle-1.png", 30, "in"),
  S("shots/giraffe-number-puzzle-1.png", 30, "out"),
  S("shots/owl-number-tower-puzzle-1.png", 30, "left"),
  S("shots/shape-peg-board-1.png", 30, "in"),
  S("shots/heart-tangram-nine-pieces-1.png", 30, "right"),
  S("shots/solar-system-peg-puzzle-1.png", 30, "in"),
  S("shots/alphabet-learning-board-1.png", 30, "left"),

  // ── 5. the close ──────────────────────────────────────────────────────────
  S("shots/abc-jigsaw-board-2.png", 165, "in", { line: "Nothing is made until you ask for it." }),
];

export const TOTAL_FRAMES = SHOTS.reduce((n, s) => n + s.frames, 0);
