import React from "react";
import {
  AbsoluteFill, Img, Sequence, staticFile,
  interpolate, useCurrentFrame, useVideoConfig, Easing,
} from "remotion";
import { SHOTS, FPS, type Shot } from "./film";

/**
 * Lebon Grace launch film.
 *
 * Built entirely from the shop's own unwatermarked product photographs — the
 * public copies are tiled with a lebon-grace.com watermark, so everything here
 * reads from originals/ instead.
 *
 * LAYOUT. The photograph occupies the upper frame and the type sits on a band
 * of brand paper beneath it. Four earlier attempts put type over the image and
 * every one failed: a dark scrim killed the warm cream palette these photos
 * live on, and ink-on-photo collided with the engraved letters, which are the
 * product. Splitting them means the type never fights the thing being sold, and
 * it holds across all 78 photographs regardless of how each was composed.
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
 * One photograph with a slow move.
 *
 * The move is deliberately gentle — about 6% over a shot. Anything faster reads
 * as a slideshow effect rather than a camera, and on a still photograph the eye
 * notices the difference immediately.
 */
const Photo: React.FC<{ shot: Shot; height: number }> = ({ shot, height }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, shot.frames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  const zoom = shot.motion === "out" ? 1.05 - p * 0.05 : 1 + p * 0.05;
  const dx = shot.motion === "left" ? -p * 1.6 : shot.motion === "right" ? p * 1.6 : 0;

  // A short fade at each end rather than a hard cut. At 1.5s per shot a hard
  // cut on a still image strobes; six frames is enough to soften it without
  // reading as a dissolve.
  const opacity = interpolate(frame, [0, 6, shot.frames - 6, shot.frames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    // contain, not cover. These are 4:3 photographs and the frame is 16:9, so
    // cover cropped the hull off the boat and threw away the linen, the dried
    // flowers and the stone — the styling that makes them worth showing. Sitting
    // the whole photograph on paper reads as a catalogue page instead of a
    // botched crop, and it suits a hand-made product better than a tight crop.
    <div style={{ height, overflow: "hidden", position: "relative", background: PAPER,
                  paddingTop: 28, paddingBottom: 8 }}>
      <Img
        src={staticFile(shot.src)}
        style={{
          width: "100%", height: "100%", objectFit: "contain",
          transform: `scale(${zoom}) translateX(${dx}%)`,
          opacity,
        }}
      />
    </div>
  );
};

/** The strikethrough: a rule that draws itself across the line it cancels. */
const Strike: React.FC<{ before: string; after: string; frames: number; size: number }> = ({
  before, after, frames, size,
}) => {
  const frame = useCurrentFrame();

  const inBefore = interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // The rule sweeps left to right over half a second. Slower and it feels
  // laboured; faster and the eye misses that the line was cancelled at all.
  const rule = interpolate(frame, [42, 57], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const inAfter = interpolate(frame, [66, 84], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(frame, [66, 84], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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
        marginTop: size * 0.42, fontSize: size,
        opacity: inAfter, transform: `translateY(${rise}px)`,
      }}>
        {after}
      </div>
    </div>
  );
};

/** A single line, no cancellation. */
const Line: React.FC<{ text: string; frames: number; size: number }> = ({ text, frames, size }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [8, 26, frames - 14, frames - 2], [0, 1, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const rise = interpolate(frame, [8, 26], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{
      textAlign: "center", fontFamily: "Fraunces, serif", color: INK,
      fontSize: size, opacity: o, transform: `translateY(${rise}px)`,
    }}>
      {text}
    </div>
  );
};

/** Wordmark and address, held on the last shot. */
const EndCard: React.FC<{ frames: number; size: number }> = ({ frames, size }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [60, 84], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ textAlign: "center", opacity: o }}>
      <div style={{
        fontFamily: "Fraunces, serif", color: INK, fontSize: size * 1.15,
        letterSpacing: size * 0.06, textTransform: "uppercase",
      }}>
        Lebon Grace
      </div>
      <div style={{
        fontFamily: "Karla, sans-serif", color: SAND, fontSize: size * 0.42,
        letterSpacing: size * 0.05, marginTop: size * 0.3, textTransform: "uppercase",
      }}>
        shop.lebon-grace.com
      </div>
    </div>
  );
};

export const LaunchFilm: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => {
  const { height } = useVideoConfig();

  // Vertical gives the type more room because there is more frame to spare;
  // horizontal keeps the photograph dominant.
  const photoH = vertical ? Math.round(height * 0.62) : Math.round(height * 0.66);
  const size = vertical ? 62 : 58;

  // Shot offsets are computed BEFORE the render tree, and computed PURELY.
  // The original accumulated a running total inside the JSX .map(), which is
  // wrong under React's double-render -- the second pass keeps adding to an
  // already-advanced total, so every shot lands at the wrong frame. The React
  // Compiler lint rejects any such reassignment during render ("Cannot
  // reassign variable after render completes"), including inside a helper
  // closure, so this reassigns nothing at all. SHOTS is a handful of shots, so
  // the quadratic sum costs nothing and stays obviously correct.
  const starts = SHOTS.map((_shot, i) =>
    SHOTS.slice(0, i).reduce((total, s) => total + s.frames, 0),
  );
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Fonts />
      {SHOTS.map((shot, i) => {
        const from = starts[i];
        const isLast = i === SHOTS.length - 1;
        return (
          <Sequence key={i} from={from} durationInFrames={shot.frames}>
            <AbsoluteFill>
              <Photo shot={shot} height={photoH} />
              <div style={{
                position: "absolute", top: photoH, left: 0, right: 0, bottom: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 6%", background: PAPER,
              }}>
                {shot.strike && <Strike {...shot.strike} frames={shot.frames} size={size} />}
                {shot.line && !isLast && <Line text={shot.line} frames={shot.frames} size={size} />}
                {isLast && (
                  <div>
                    <Line text={shot.line ?? ""} frames={90} size={size} />
                    <div style={{ height: size * 0.9 }} />
                    <EndCard frames={shot.frames} size={size} />
                  </div>
                )}
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
