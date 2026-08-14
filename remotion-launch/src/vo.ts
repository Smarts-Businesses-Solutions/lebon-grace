/**
 * The voiceover, as data: which line, and the frame it starts on.
 *
 * SINGLE SOURCE OF TRUTH. `voice.mjs` reads this file to generate the audio and
 * to check each line fits before the next one starts; the films read it to
 * place the clips. Keeping the frames in two places would guarantee that a
 * re-timed shot moves the picture and not the voice, and nobody would notice
 * until they listened.
 *
 * The voice never restates a caption. That is the failure mode with narration
 * over typography — the viewer processes the same sentence twice and the film
 * feels padded — so the engraving and sanding shots, whose captions already
 * carry the point, have no line over them at all.
 *
 * The colour-in beats are silent for the same reason their captions are blank:
 * no copy on the site describes that version of the product, so there is
 * nothing true to say over it yet.
 */

export type VoLine = {
  /** Matches the file at public/audio/vo/<film>-<id>.mp3 */
  id: string;
  /** Absolute frame in the composition, 30fps. */
  frame: number;
  /** Kept here so the script and the audio cannot drift apart silently. */
  text: string;
};

export const VO: Record<"making" | "correction", VoLine[]> = {
  making: [
    { id: "m01", frame: 30, text: "Nothing here is sitting in a warehouse." },
    { id: "m02", frame: 240, text: "It starts as one sheet of MDF, and a laser." },
    { id: "m03", frame: 390, text: "The letters are cut, not printed." },
    { id: "m04", frame: 540, text: "Then every piece is checked by hand." },
    { id: "m05", frame: 800, text: "The same price for everything in the shop." },
    { id: "m06", frame: 900, text: "Made for one child, not for a shelf." },
    { id: "m07", frame: 1290, text: "Packed by hand." },
    { id: "m08", frame: 1470, text: "Lebon Grace." },
  ],

  // Statement shots start at 0, 420, 750 and 1410 and run 240 frames. Within
  // each, the struck line is spoken from frame 10 as it appears and the
  // replacement from frame 132 as it rises — so the rule crossing the words at
  // frame 100 lands in the silence between them, which is what makes it read as
  // somebody catching themselves rather than being interrupted.
  correction: [
    { id: "c01a", frame: 10, text: "This puzzle is in stock." },
    { id: "c01b", frame: 132, text: "It isn't. It doesn't exist yet." },
    { id: "c02a", frame: 430, text: "We ship it the same day." },
    { id: "c02b", frame: 552, text: "We start cutting it." },
    { id: "c03a", frame: 760, text: "The engraving costs extra." },
    { id: "c03b", frame: 882, text: "It doesn't. It never has." },
    { id: "c04a", frame: 1420, text: "A machine made this." },
    { id: "c04b", frame: 1542, text: "A machine helped." },
    { id: "c05", frame: 1660, text: "Nothing is made until you ask for it." },
    { id: "c06", frame: 1755, text: "Lebon Grace." },
  ],
};

/**
 * Room tone, looped under everything.
 *
 * Every audio file is loudness-normalised by normalize.mjs — voice to -16 LUFS,
 * foley to -28, room tone to -38 — so everything plays at volume 1 here and the
 * balance is already correct. Setting volumes by hand would mean setting them
 * by guesswork, since the mix was built without anyone able to hear it.
 */
export const ROOM_FRAMES = 240;

/** public/audio/bed/<name>.mp3 for a shot whose src is stock/<name>.mp4 */
export const bedFor = (src: string): string | null => {
  const m = src.match(/^stock\/(.+)\.mp4$/);
  return m ? `audio/bed/${m[1]}.mp3` : null;
};
