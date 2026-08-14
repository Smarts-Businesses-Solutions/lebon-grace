import React from "react";
import {
  AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile,
  interpolate, useCurrentFrame, useVideoConfig, Easing,
} from "remotion";
import { MAKING, MAKING_FRAMES, type Making } from "./making";
import { RoomTone, Foley, VoiceTrack, EndNote } from "./Sound";
import { bedFor } from "./vo";

/**
 * Lebon Grace — "The Making".
 *
 * Stock workshop footage full-bleed, the shop's own product photographs on
 * brand paper. See making.ts for why the two registers are kept apart and why
 * every caption is a checked fact.
 */

const INK = "#23201c";
const PAPER = "#f7f3ec";
const SAND = "#c9a96e";

const fontFace = (family: string, file: string) =>
  `@font-face{font-family:'${family}';src:url('${staticFile(file)}') format('truetype');font-display:block;}`;

export const Fonts: React.FC = () => (
  <style>{fontFace("Fraunces", "fonts/Fraunces.ttf") + fontFace("Karla", "fonts/Karla.ttf")}</style>
);

/**
 * A warm, low-contrast grade.
 *
 * The six stock clips come from five different shoots and do not cut together
 * raw — one is cool daylight, one is tungsten-warm. Pulling saturation and
 * contrast down and adding a little warmth lands them all near the shop's own
 * photography, which is cream linen in daylight. Deliberately NOT the reference
 * film's teal-and-orange: that grade would fight honey-toned MDF.
 */
const GRADE = "saturate(0.88) contrast(0.94) brightness(1.03) sepia(0.10)";

/**
 * NO EDGE FADES — hard cuts throughout.
 *
 * The first film fades six frames at each end because it is 30 still
 * photographs at 1.5s each, where a hard cut on a still strobes. Carrying that
 * over to this film was wrong and produced a visible fault: consecutive
 * Sequences do not overlap, so a fade-out landing on a fade-in put a fully
 * black frame at every clip boundary (verified at frame 120 — solid black,
 * with a ramp down and up either side). Five of those in a warm cream film
 * read as a broken encode.
 *
 * Shots here run 4-6 seconds of real footage, which is exactly what a hard cut
 * is for. Anything softer would need genuinely overlapping sequences, and this
 * film does not want a dissolve.
 */

/**
 * The caption: ink on a small slip of brand paper, lower-left.
 *
 * Type straight onto footage was unreadable across six clips of wildly
 * different luminance — white text vanished on the pale sanding shot, ink
 * vanished on the dark cutting shot. A paper slip is legible over anything and
 * ties the footage back to the brand instead of floating on top of it.
 */
const Caption: React.FC<{
  text: string; frames: number; size: number; pad: number; bottom: number;
}> = ({ text, frames, size, pad, bottom }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [10, 28, frames - 16, frames - 4], [0, 1, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const rise = interpolate(frame, [10, 28], [10, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <div style={{
      position: "absolute", left: pad, bottom,
      opacity: o, transform: `translateY(${rise}px)`,
      background: PAPER, color: INK,
      fontFamily: "Karla, sans-serif", fontSize: size,
      letterSpacing: size * 0.02,
      padding: `${size * 0.55}px ${size * 0.9}px`,
      boxShadow: "0 2px 18px rgba(35,32,28,0.18)",
    }}>
      {text}
    </div>
  );
};

/** Full-bleed stock footage. */
const Clip: React.FC<{ shot: Extract<Making, { kind: "clip" }> }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, shot.frames], [0, 1], {
    extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease),
  });
  // 4% over a shot. Enough to feel alive, not enough to read as a zoom effect.
  const scale = shot.drift === "out" ? 1.04 - p * 0.04 : 1 + p * 0.04;

  // Paper, not ink, behind the footage: any gap must resolve to the brand's
  // cream rather than to black.
  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(shot.src)}
        muted
        style={{
          width: "100%", height: "100%", objectFit: "cover",
          transform: `scale(${scale})`,
          filter: GRADE,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * A product photograph as a catalogue plate on brand paper.
 *
 * contain, not cover: these are 4:3 photographs styled with dried flowers, a
 * grey stone and cream linen, and a 16:9 cover crop throws all of that away
 * along with the edges of the puzzle. The exception is a deliberate macro
 * (zoom > 1), where cropping in IS the shot.
 */
const Plate: React.FC<{ shot: Extract<Making, { kind: "plate" }>; pad: number }> = ({ shot, pad }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, shot.frames], [0, 1], {
    extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease),
  });
  const base = shot.zoom ?? 1;
  const scale = base + p * (shot.zoom ? 0.10 : 0.04);

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <Img
        src={staticFile(shot.src)}
        style={{
          width: "100%", height: "100%",
          objectFit: shot.zoom ? "cover" : "contain",
          objectPosition: shot.focus ?? "center",
          transform: `scale(${scale})`,
          // Light padding only. A full pad*1.2 border left the puzzle floating
          // small in a field of paper and reading as an afterthought rather
          // than as the thing the film is about.
          padding: shot.zoom ? 0 : pad * 0.45,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * The close: last fact, then the wordmark.
 *
 * The closing line lives inside the end card rather than in the lower-left
 * caption slot. Running both would put two blocks of type on one frame and
 * make the last thing the viewer sees look cluttered, which is the opposite of
 * what a film this quiet is for.
 */
const EndCard: React.FC<{ size: number; line: string }> = ({ size, line }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [70, 100], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const rise = interpolate(frame, [70, 100], [16, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{
      alignItems: "center", justifyContent: "center",
      opacity: o, transform: `translateY(${rise}px)`,
    }}>
      <div style={{
        textAlign: "center",
        background: PAPER,
        padding: `${size * 1.3}px ${size * 2.4}px`,
        boxShadow: "0 4px 40px rgba(35,32,28,0.14)",
      }}>
        <div style={{
          fontFamily: "Karla, sans-serif", color: INK, fontSize: size * 0.8,
          marginBottom: size * 1.1,
        }}>
          {line}
        </div>
        <div style={{
          fontFamily: "Fraunces, serif", color: INK, fontSize: size * 1.5,
          letterSpacing: size * 0.09, textTransform: "uppercase",
        }}>
          Lebon Grace
        </div>
        <div style={{
          fontFamily: "Karla, sans-serif", color: SAND, fontSize: size * 0.55,
          letterSpacing: size * 0.07, marginTop: size * 0.5, textTransform: "uppercase",
        }}>
          shop.lebon-grace.com
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const MakingFilm: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => {
  const { width, height } = useVideoConfig();

  // Everything scales off frame width so the vertical cut is a genuine
  // re-layout rather than a centre-crop that would push the caption off-frame.
  const pad = Math.round(width * (vertical ? 0.07 : 0.05));
  const size = Math.round(width * (vertical ? 0.036 : 0.022));

  // VERTICAL CAPTIONS SIT HIGHER, and that is not a taste decision. TikTok and
  // YouTube Shorts paint their own UI over the bottom of the frame — username,
  // caption, music ticker — roughly the lowest 15-20%. At the horizontal pad
  // the caption landed squarely under it and was simply invisible on both
  // platforms. 20% clears it with margin.
  const captionBottom = vertical ? Math.round(height * 0.20) : pad;

  let at = 0;
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Fonts />
      <RoomTone total={MAKING_FRAMES} />
      <VoiceTrack film="making" />
      {MAKING.map((shot, i) => {
        const from = at;
        at += shot.frames;
        const bed = shot.kind === "clip" ? bedFor(shot.src) : null;
        return (
          <Sequence key={i} from={from} durationInFrames={shot.frames}>
            {bed && <Foley bed={bed} />}
            {shot.kind === "plate" && shot.end && <EndNote film="making" />}
            <AbsoluteFill>
              {shot.kind === "clip"
                ? <Clip shot={shot} />
                : <Plate shot={shot} pad={pad} />}
              {shot.kind === "plate" && shot.end
                ? <EndCard size={size} line={shot.label ?? ""} />
                : shot.label && (
                    <Caption text={shot.label} frames={shot.frames} size={size}
                             pad={pad} bottom={captionBottom} />
                  )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
