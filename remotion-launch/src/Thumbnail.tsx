import React from "react";
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";

/**
 * Thumbnails, in the same type and palette as the films.
 *
 * The upload kit said "crop a product photo to 16:9 and add nothing", which was
 * advice, not an asset. Nothing was ever generated, so there was no thumbnail
 * to upload. This produces real ones.
 *
 * Deliberately quiet. The convention for a launch thumbnail is a shouting
 * headline and an arrow, and that would misrepresent a film whose whole method
 * is understatement. A viewer arriving from a loud thumbnail onto a slow, plain
 * film bounces. One short true line on brand paper is the honest signal of what
 * they are about to watch.
 */

const INK = "#23201c";
const PAPER = "#f7f3ec";
const SAND = "#c9a96e";

const fontFace = (family: string, file: string) =>
  `@font-face{font-family:'${family}';src:url('${staticFile(file)}') format('truetype');font-display:block;}`;

export type ThumbProps = {
  /** Under public/shots/ or public/stock frame exports. */
  image: string;
  /** One short true line. Kept to a few words so it reads at 210px wide. */
  line: string;
  /** Push the crop toward the subject when the photo is off-centre. */
  focus?: string;
};

export const Thumbnail: React.FC<ThumbProps> = ({ image, line, focus = "center" }) => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;

  // Everything scales off the short edge so one component serves 1280x720 and
  // 1080x1920 without the type collapsing on the vertical crop.
  const base = Math.min(width, height);
  const pad = Math.round(base * 0.06);
  const size = Math.round(base * (vertical ? 0.055 : 0.062));

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <style>{fontFace("Fraunces", "fonts/Fraunces.ttf") + fontFace("Karla", "fonts/Karla.ttf")}</style>

      <Img
        src={staticFile(image)}
        style={{
          width: "100%", height: "100%", objectFit: "cover", objectPosition: focus,
          // Matches the films exactly so a thumbnail never looks like a
          // different shoot from the video it fronts.
          filter: "saturate(0.88) contrast(0.94) brightness(1.03) sepia(0.10)",
        }}
      />

      <div style={{
        position: "absolute", left: pad, bottom: pad,
        background: PAPER, color: INK,
        fontFamily: "Karla, sans-serif", fontSize: size,
        lineHeight: 1.28, letterSpacing: size * 0.01,
        padding: `${size * 0.72}px ${size * 1.0}px`,
        maxWidth: "72%",
        boxShadow: "0 3px 26px rgba(35,32,28,0.24)",
      }}>
        {line}
      </div>

      <div style={{
        position: "absolute", right: pad, bottom: pad, textAlign: "right",
        fontFamily: "Fraunces, serif", color: PAPER,
        fontSize: size * 0.62, letterSpacing: size * 0.06, textTransform: "uppercase",
        textShadow: "0 2px 14px rgba(35,32,28,0.55)",
      }}>
        Lebon Grace
        {/*
          White, not sand. The brand sand reads beautifully on paper and all but
          vanishes over cream linen at thumbnail scale, which is the one place
          this has to survive being 210px wide.
        */}
        <div style={{
          fontFamily: "Karla, sans-serif", color: PAPER, fontSize: size * 0.32,
          letterSpacing: size * 0.05, marginTop: size * 0.18,
        }}>
          SHOP.LEBON-GRACE.COM
        </div>
      </div>
    </AbsoluteFill>
  );
};
