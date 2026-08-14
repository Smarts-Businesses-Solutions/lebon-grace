import React from "react";
import { Composition } from "remotion";
import { LaunchFilm } from "./LaunchFilm";
import { FPS, TOTAL_FRAMES } from "./film";
import { MakingFilm } from "./MakingFilm";
import { MAKING_FRAMES } from "./making";
import { CorrectionFilm } from "./CorrectionFilm";
import { EndCardStandalone } from "./EndCardStandalone";
import { Thumbnail } from "./Thumbnail";
import { CORRECTION_FRAMES } from "./correction";

/**
 * Two deliverables from one film.
 *
 * The horizontal master is for YouTube and LinkedIn. The vertical is a genuine
 * re-layout rather than a centre-crop — a crop would cut the type band off, and
 * the type is half the film.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LaunchMaster"
      component={LaunchFilm}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ vertical: false }}
    />
    <Composition
      id="LaunchVertical"
      component={LaunchFilm}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ vertical: true }}
    />

    {/* "The Making" — the process film, stock footage plus our own product. */}
    <Composition
      id="MakingMaster"
      component={MakingFilm}
      durationInFrames={MAKING_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ vertical: false }}
    />
    <Composition
      id="MakingVertical"
      component={MakingFilm}
      durationInFrames={MAKING_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ vertical: true }}
    />

    {/* "The Correction" — Script A, the strikethrough film, over footage. */}
    <Composition
      id="CorrectionMaster"
      component={CorrectionFilm}
      durationInFrames={CORRECTION_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ vertical: false }}
    />
    <Composition
      id="CorrectionVertical"
      component={CorrectionFilm}
      durationInFrames={CORRECTION_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ vertical: true }}
    />

    {/* The wordmark alone, for repairing externally generated clips whose own
        end card came back with the brand name wrong. 720p/24fps to match the
        Veo sources it gets appended to. */}
    <Composition
      id="EndCard720"
      component={EndCardStandalone}
      durationInFrames={60}
      fps={24}
      width={1280}
      height={720}
    />

    {/* Thumbnails. Rendered as stills, not video: `remotion still`. */}
    <Composition
      id="Thumb169"
      component={Thumbnail}
      durationInFrames={1} fps={30} width={1280} height={720}
      defaultProps={{ image: "shots/abc-jigsaw-board-0.png",
                      line: "Nothing is in stock.", focus: "50% 45%" }}
    />
    <Composition
      id="Thumb916"
      component={Thumbnail}
      durationInFrames={1} fps={30} width={1080} height={1920}
      defaultProps={{ image: "shots/abc-jigsaw-board-0.png",
                      line: "Nothing is in stock.", focus: "50% 45%" }}
    />
  </>
);
