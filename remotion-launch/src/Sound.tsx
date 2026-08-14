import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { VO, ROOM_FRAMES, type VoLine } from "./vo";

/**
 * The sound layer, shared by both films.
 *
 * Three tiers, and they are separated because they are mixed differently:
 *
 *   room tone   -38 LUFS   under everything, always
 *   foley       -28 LUFS   per shot, only over stock footage
 *   voice       -16 LUFS   per line, at exact frames
 *
 * Every file is loudness-normalised to those targets by normalize.mjs, so
 * everything plays at volume 1 here. That is deliberate: this mix was built by
 * people who could not hear it, and `volume={0.3}` would have been a guess.
 * Normalising to a measured target makes the balance correct by construction
 * and, more importantly, checkable afterwards.
 */

/**
 * Room tone, repeated to cover the whole film.
 *
 * Explicit repeats rather than a `loop` prop: the source is 8s and the films
 * run 52s and 61s, and laying the repeats out by hand works on any Remotion
 * version. Without this the product plates — which have no foley of their own —
 * cut to digital silence, which does not read as "quiet", it reads as broken.
 */
export const RoomTone: React.FC<{ total: number }> = ({ total }) => (
  <>
    {Array.from({ length: Math.ceil(total / ROOM_FRAMES) }, (_, i) => (
      <Sequence key={i} from={i * ROOM_FRAMES} durationInFrames={ROOM_FRAMES}>
        <Audio src={staticFile("audio/bed/room.mp3")} />
      </Sequence>
    ))}
  </>
);

/** Per-shot foley. Rendered inside the shot's own Sequence, so it is clipped with it. */
export const Foley: React.FC<{ bed: string }> = ({ bed }) => (
  <Audio src={staticFile(bed)} />
);

/**
 * The one sustained warm note, under the end card.
 *
 * Both scripts ask for exactly this and nothing else: "no music at all until
 * the final card, where one sustained warm note is enough". It is the only
 * music in either film, and it should stay that way — the absence everywhere
 * else is what makes the films feel like a room rather than an advert.
 *
 * Synthesised by note.mjs and cut to each film's closing shot, so its release
 * lands on the last frame instead of being clipped mid-fade. Rendered inside
 * the closing Sequence, which is why it needs no offset here.
 */
export const EndNote: React.FC<{ film: keyof typeof VO }> = ({ film }) => (
  <Audio src={staticFile(`audio/bed/note-${film}.mp3`)} />
);

/**
 * The narration, placed at absolute frames.
 *
 * Frames come from vo.ts, which voice.mjs also reads — so a line cannot be
 * re-timed in one place and not the other.
 */
export const VoiceTrack: React.FC<{ film: keyof typeof VO }> = ({ film }) => (
  <>
    {VO[film].map((line: VoLine) => (
      <Sequence key={line.id} from={line.frame}>
        <Audio src={staticFile(`audio/vo/${film}-${line.id}.mp3`)} />
      </Sequence>
    ))}
  </>
);
