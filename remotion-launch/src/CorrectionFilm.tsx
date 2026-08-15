import React from "react";
import {
  AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile,
  interpolate, useCurrentFrame, useVideoConfig, Easing,
} from "remotion";
import { CORRECTION, CORRECTION_FRAMES, type Correction } from "./correction";
import { RoomTone, Foley, VoiceTrack, EndNote } from "./Sound";
import { bedFor } from "./vo";

/**
 * Lebon Grace — "The Correction".
 *
 * Shares its footage, grade and two registers with MakingFilm. The difference
 * is the type: this film argues, so the words need weight and room, and they
 * sit in Fraunces on a band of brand paper rather than in a small corner slip.
 *
 * WHY A BAND, NOT TYPE ON THE FOOTAGE. The reference film sets its
 * strikethrough straight over its own footage, which it can do because it shot
 * that footage and graded it dark. Ours is six stock clips from five different
 * shoots, ranging from a near-white sanding bench to a dim workshop — no single
 * ink or white would stay legible across all of them, and a dark scrim to force
 * it would kill exactly the warm cream palette the brand lives on. A paper band
 * is legible over anything and reads as the brand rather than as an overlay.
 */

const INK = "#23201c";
const PAPER = "#f7f3ec";
const SAND = "#c9a96e";

const fontFace = (family: string, file: string) =>
  `@font-face{font-family:'${family}';src:url('${staticFile(file)}') format('truetype');font-display:block;}`;

const Fonts: React.FC = () => (
  <style>{fontFace("Fraunces", "fonts/Fraunces.ttf") + fontFace("Karla", "fonts/Karla.ttf")}</style>
);

/** Matches MakingFilm exactly, so the two films cut together in a feed. */
const GRADE = "saturate(0.88) contrast(0.94) brightness(1.03) sepia(0.10)";

/**
 * The device: a rule sweeps through the line, then the truer line rises.
 *
 * Timings are absolute frame numbers, not fractions of the shot, so the beat
 * feels identical on every statement shot. All four are 240 frames.
 *
 * PACED TO THE VOICE. The silent cut struck at frame 42 and replaced at 66,
 * which is right when the type is the only thing carrying the line. With a
 * voiceover it is wrong: the read of "A machine made this" runs 2.9s, so the
 * replacement appeared and was spoken while the struck line was still being
 * said. The rule now waits until the first line has been fully spoken (~frame
 * 98), crosses while nobody is talking, and the replacement rises just before
 * the voice says it at 132.
 *
 * If the voice is ever removed, these can go back to 42/66.
 */
const STRIKE_IN = [8, 24];       // struck line appears; voice says it from 10
const STRIKE_RULE = [100, 117];  // rule crosses, in the pause after the line
const STRIKE_AFTER = [127, 145]; // replacement rises; voice says it from 132

const Strike: React.FC<{ before: string; after: string; size: number }> = ({ before, after, size }) => {
  const frame = useCurrentFrame();
  const inBefore = interpolate(frame, STRIKE_IN, [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rule = interpolate(frame, STRIKE_RULE, [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const inAfter = interpolate(frame, STRIKE_AFTER, [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(frame, STRIKE_AFTER, [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ textAlign: "center", fontFamily: "Fraunces, serif", color: INK }}>
      <div style={{ position: "relative", display: "inline-block", fontSize: size, opacity: inBefore }}>
        {before}
        <div style={{
          position: "absolute", left: 0, top: "52%", height: Math.max(3, size * 0.045),
          width: `${rule}%`, background: INK, borderRadius: 2,
        }} />
      </div>
      <div style={{
        marginTop: size * 0.45, fontSize: size,
        opacity: inAfter, transform: `translateY(${rise}px)`,
      }}>
        {after}
      </div>
    </div>
  );
};

/**
 * The band the type sits on. Only drawn on shots that carry words.
 *
 * `bottom` is 0 on the horizontal master, but lifted on the vertical cut:
 * TikTok and YouTube Shorts paint username, caption and music ticker over
 * roughly the lowest 15-20% of the frame, and a band flush to the bottom edge
 * disappeared underneath it entirely — taking all four corrections with it.
 */
const Band: React.FC<{ pad: number; bottom: number; children: React.ReactNode }> = ({
  pad, bottom, children,
}) => (
  <div style={{
    position: "absolute", left: 0, right: 0, bottom,
    background: PAPER,
    padding: `${pad * 0.9}px ${pad}px`,
    boxShadow: "0 -2px 30px rgba(35,32,28,0.16)",
  }}>
    {children}
  </div>
);

/**
 * A plain fact, on a slip of brand paper, for the shots that carry no strike.
 *
 * Seven of the twelve shots had no type at all. That was defensible while the
 * strikes were the only voice, but it left long stretches with nothing on
 * screen. These fill them without competing: Karla rather than Fraunces, so a
 * caption never reads as a fifth correction.
 *
 * Lower-RIGHT and full size, matching The Making. The two films sit next to
 * each other in a feed and a caption that jumps corner to corner between them
 * reads as a mistake.
 */
const Caption: React.FC<{
  text: string; frames: number; size: number;
  bottom: number; right: number; maxWidth: number; minWidth: number;
}> = ({ text, frames, size, bottom, right, maxWidth, minWidth }) => {
  const frame = useCurrentFrame();
  // No fade. Any ramp leaves opacity at 0 on frame 0, so every cut point
  // showed a bare frame. The picture hard-cuts here, so the type does too.
  const o = 1;
  const rise = 0;

  return (
    <div style={{
      position: "absolute", right, bottom,
      opacity: o, transform: `translateY(${rise}px)`,
      background: PAPER, color: INK,
      fontFamily: "Karla, sans-serif", fontSize: size,
      lineHeight: 1.34, letterSpacing: size * 0.02,
      padding: `${size * 0.8}px ${size * 1.15}px`,
      minWidth, maxWidth,
      boxShadow: "0 2px 22px rgba(35,32,28,0.20)",
    }}>
      {text}
    </div>
  );
};

const Clip: React.FC<{ shot: Extract<Correction, { kind: "clip" }> }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, shot.frames], [0, 1], {
    extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease),
  });
  const scale = shot.drift === "out" ? 1.04 - p * 0.04 : 1 + p * 0.04;

  // Hard cuts, paper behind. See MakingFilm: edge fades on non-overlapping
  // Sequences put a fully black frame at every boundary.
  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(shot.src)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})`, filter: GRADE }}
      />
    </AbsoluteFill>
  );
};

const Plate: React.FC<{ shot: Extract<Correction, { kind: "plate" }>; pad: number }> = ({ shot, pad }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, shot.frames], [0, 1], {
    extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease),
  });
  const base = shot.zoom ?? 1;
  const scale = base + p * (shot.zoom ? 0.10 : 0.04);

  // A plate that carries a strike gets its own box above the band, rather than
  // centring in the full frame and being covered by it — the first cut sliced
  // the bottom row of letters off the alphabet board.
  //
  // Padding alone fixed the overlap and created a worse problem: these are
  // styled flat-lays with wide linen margins of their own, so `contain` fits
  // the whole PHOTOGRAPH and the puzzle inside it ends up tiny. The box crops
  // instead — overflow hidden plus a scale that eats the photo's own margins,
  // so the product reads large and still never reaches the band.
  const boxed = !shot.zoom && !!shot.strike;
  const crop = boxed ? 1.3 : 1;

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: boxed ? "66%" : "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        <Img
          src={staticFile(shot.src)}
          style={{
            width: "100%", height: "100%",
            objectFit: shot.zoom ? "cover" : "contain",
            objectPosition: shot.focus ?? "center",
            transform: `scale(${scale * crop})`,
            padding: shot.zoom ? 0 : pad * 0.45,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** The closing statement and the wordmark, on paper over the final plate. */
const EndCard: React.FC<{ size: number; line: string }> = ({ size, line }) => {
  const frame = useCurrentFrame();
  const lineIn = interpolate(frame, [10, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const markIn = interpolate(frame, [80, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(frame, [10, 34], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{
        textAlign: "center", background: PAPER,
        padding: `${size * 1.2}px ${size * 2.0}px`,
        boxShadow: "0 4px 40px rgba(35,32,28,0.14)",
        opacity: lineIn, transform: `translateY(${rise}px)`,
      }}>
        <div style={{ fontFamily: "Fraunces, serif", color: INK, fontSize: size }}>
          {line}
        </div>
        <div style={{ opacity: markIn, marginTop: size * 1.2 }}>
          <div style={{
            fontFamily: "Fraunces, serif", color: INK, fontSize: size * 1.15,
            letterSpacing: size * 0.09, textTransform: "uppercase",
          }}>
            Lebon Grace
          </div>
          <div style={{
            fontFamily: "Karla, sans-serif", color: SAND, fontSize: size * 0.42,
            letterSpacing: size * 0.07, marginTop: size * 0.4, textTransform: "uppercase",
          }}>
            shop.lebon-grace.com
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const CorrectionFilm: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => {
  const { width, height } = useVideoConfig();
  const pad = Math.round(width * (vertical ? 0.07 : 0.05));
  /** Clear of the TikTok / Shorts UI on the vertical cut. See Band. */
  const bandBottom = vertical ? Math.round(height * 0.17) : 0;
  /** Same clearance for the plain captions on non-strike shots. */
  const captionBottom = vertical ? Math.round(height * 0.20) : pad;
  /**
   * Right-hand placement, inset clear of the vertical platform UI.
   *
   * TikTok and Reels stack like / comment / share down the right edge, roughly
   * the outer 15%. Flush-right would put the caption underneath them. Matches
   * MakingFilm exactly so the two films agree.
   */
  const captionRight = vertical ? Math.round(width * 0.20) : pad;
  const captionMaxWidth = Math.round(width * (vertical ? 0.62 : 0.42));
  const captionMinWidth = Math.round(width * (vertical ? 0.34 : 0.16));
  // Smaller than the wordmark it shares a frame with — these lines run to seven
  // words and must not wrap on the vertical cut.
  const size = Math.round(width * (vertical ? 0.048 : 0.030));

  // Shot offsets are computed BEFORE the render tree, and computed PURELY.
  // The original accumulated a running total inside the JSX .map(), which is
  // wrong under React's double-render -- the second pass keeps adding to an
  // already-advanced total, so every shot lands at the wrong frame. The React
  // Compiler lint rejects any such reassignment during render ("Cannot
  // reassign variable after render completes"), including inside a helper
  // closure, so this reassigns nothing at all. CORRECTION is a handful of shots, so
  // the quadratic sum costs nothing and stays obviously correct.
  const starts = CORRECTION.map((_shot, i) =>
    CORRECTION.slice(0, i).reduce((total, s) => total + s.frames, 0),
  );
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Fonts />
      <RoomTone total={CORRECTION_FRAMES} />
      <VoiceTrack film="correction" />
      {CORRECTION.map((shot, i) => {
        const from = starts[i];
        const isEnd = shot.kind === "plate" && shot.end;
        const bed = shot.kind === "clip" ? bedFor(shot.src) : null;
        return (
          <Sequence key={i} from={from} durationInFrames={shot.frames}>
            {bed && <Foley bed={bed} />}
            {isEnd && <EndNote film="correction" />}
            <AbsoluteFill>
              {shot.kind === "clip"
                ? <Clip shot={shot} />
                : <Plate shot={shot} pad={pad} />}
              {isEnd && <EndCard size={size} line={(shot as { line?: string }).line ?? ""} />}
              {!isEnd && shot.strike && (
                <Band pad={pad} bottom={bandBottom}>
                  <Strike {...shot.strike} size={size} />
                </Band>
              )}
              {!isEnd && !shot.strike && shot.label && (
                <Caption text={shot.label} frames={shot.frames} size={size}
                         bottom={captionBottom} right={captionRight}
                         maxWidth={captionMaxWidth} minWidth={captionMinWidth} />
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
