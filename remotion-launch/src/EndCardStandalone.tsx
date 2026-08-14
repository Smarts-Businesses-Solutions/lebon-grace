import React from "react";
import { AbsoluteFill, staticFile, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * The wordmark on brand paper, on its own.
 *
 * Exists to repair externally generated clips. A Veo render of "The Making"
 * came back with its own end card burnt into the pixels reading **"Lebanon
 * Grace"** — the wrong brand name — over a garbled URL, because the prompt was
 * taken from the script doc, which carries the typography spec. Burnt-in text
 * cannot be re-timed or corrected, but it sits at the END of the clip, so the
 * tail can simply be cut off and this appended in its place.
 *
 * Deliberately reuses the same constants and proportions as the films' own end
 * card rather than approximating them in ffmpeg drawtext, which has no
 * letter-spacing and would not match.
 *
 * Rendered at the source clip's own size and frame rate so the concatenation
 * needs no scaling or rate conversion.
 */

const INK = "#23201c";
const PAPER = "#f7f3ec";
const SAND = "#c9a96e";

const fontFace = (family: string, file: string) =>
  `@font-face{font-family:'${family}';src:url('${staticFile(file)}') format('truetype');font-display:block;}`;

export const EndCardStandalone: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();

  // Scales off width so the same component serves 1280x720 and 1920x1080.
  const size = Math.round(width * 0.045);

  // Rises in over ~0.9s. The clip it follows ends on a slow hold, so anything
  // faster reads as a cut rather than a resolution.
  const inSecs = 0.9;
  const o = interpolate(frame, [0, fps * inSecs], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const rise = interpolate(frame, [0, fps * inSecs], [14, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{
      background: PAPER, alignItems: "center", justifyContent: "center",
    }}>
      <style>{fontFace("Fraunces", "fonts/Fraunces.ttf") + fontFace("Karla", "fonts/Karla.ttf")}</style>
      <div style={{ textAlign: "center", opacity: o, transform: `translateY(${rise}px)` }}>
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
