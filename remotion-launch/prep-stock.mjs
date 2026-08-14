/**
 * Prepare the chosen stock clips for the "Making" film.
 *
 * Each clip is trimmed to a centred segment of exactly the length the edit
 * needs, scaled to 1920x1080 (cover-cropped, never letterboxed), stripped of
 * audio and re-encoded at 30fps so Remotion gets a uniform, seekable source.
 *
 * WHY CENTRED: the useful action is almost always mid-clip — stock clips open
 * and close on the camera settling. Taking the middle avoids hand-picking in
 * and out points for every clip.
 *
 * The clips chosen here were each verified by looking at extracted frames, not
 * by trusting the search title. Four clips titled "laser cutting wood" turned
 * out to be industrial metal lasers throwing sparks, and three doorstep clips
 * carried visible Amazon branding, which both stock licences bar from
 * commercial use.
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SRC = "C:/Users/user/AppData/Local/Temp/claude/C--Users-user-Desktop-aprojects-lebon-grace--claude-worktrees-lebon-grace-review-12cdd4/b843391a-0739-4b76-a980-8fcfae50c9f7/scratchpad/stock/picks";

/** Generated shots live in the repo, not the scratchpad — they cost money. */
const LTX = path.join(HERE, "..", ".ltx-takes");
const OUT = path.join(HERE, "public", "stock");
fs.mkdirSync(OUT, { recursive: true });

/**
 * pick key -> [output name, seconds needed by the edit].
 *
 * Each length is the MAXIMUM the clip is asked for across BOTH films, not the
 * length either one uses alone. Two films share these files, and a Sequence
 * longer than its source does not error — it simply holds the last frame, which
 * reads as a freeze nobody would notice until it shipped. Prepping to the
 * longest demand makes that impossible.
 *
 *   order 4s (making) / 5s (correction)   -> 5
 *   sheet 3.5s / 5s                       -> 5
 *   cut   4.5s / 3s                       -> 4.5
 *   lift  3.5s / 5s                       -> 5
 *   sand  4.5s / 3s                       -> 4.5
 *   pack  4s   / 3s                       -> 4
 *   play  4.5s / 4s                       -> 4.5
 *   colour 4.5s / 4s                      -> 4.5
 */
const CLIPS = [
  // 8s for the three that carry a spoken correction. The Correction's statement
  // shots grew from 150 to 240 frames once the voice was added: the device gives
  // a line 1.87s and the unhurried read needs 2.9s, so at the old length the
  // replacement line started while the struck line was still being spoken.
  ["1-order_2",   "order",  8],
  ["3-cut_7",     "sheet",  8],
  // The fourth statement shot needed a source longer than 8s and `lift` is only
  // 7.0s, so it gets its own clip rather than being stretched or held.
  ["3-cut_5",     "inspect", 8],
  // ── generated, not stock ────────────────────────────────────────────────
  // The two shots free stock could not provide, from fal.ai LTX-2.3 Fast at
  // 1080p. `cut` replaces a wood router that was standing in for a laser;
  // `name` is new and replaces a macro of our own product photography.
  //
  // Take numbers are not arbitrary. cut-t3 was chosen over t1 because t1 has
  // "CO2" lettering rendered on the machine head, and the brief is no text.
  // name-t1 was the only one of three whose letters were real — t2 and t3 both
  // produced garbled pseudo-lettering, which is the standard generative
  // failure on text and the reason three takes were budgeted.
  ["cut-t3",      "cut",    4.5, LTX],
  ["name-t1",     "name",   5.5, LTX],
  ["5-lift_1",    "lift",   5],
  ["6-sand_3",    "sand",   4.5],
  ["8-packed_0",  "pack",   4],
  // A child's hands placing pieces into a wooden puzzle board, and a child
  // colouring in a printed outline. Hands only in both — no identifiable face.
  // Neither stock licence guarantees a model release, and an advert built
  // around an identifiable child is the worst place to discover that.
  ["P-puzzle_6",  "play",   4.5],
  ["C-colour_45", "colour", 4.5],
];

for (const [key, name, secs, dir] of CLIPS) {
  const src = path.join(dir ?? SRC, `${key}.mp4`);
  const dst = path.join(OUT, `${name}.mp4`);

  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", src,
  ]);
  const dur = parseFloat(stdout.trim());
  if (dur < secs) throw new Error(`${key}: ${dur.toFixed(1)}s source cannot fill a ${secs}s slot`);

  const start = Math.max(0, (dur - secs) / 2);

  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", start.toFixed(2), "-t", String(secs), "-i", src,
    "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30",
    "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    dst,
  ]);

  // Confirm the output is really the geometry and length the edit assumes,
  // rather than trusting that ffmpeg did what was asked.
  const probe = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,nb_frames:format=duration",
    "-of", "default=nw=1:nk=1", dst,
  ]);
  const [w, h, frames, outDur] = probe.stdout.trim().split(/\r?\n/);
  const ok = Number(w) === 1920 && Number(h) === 1080 && Math.abs(Number(outDur) - secs) < 0.2;
  console.log(
    `${name.padEnd(6)} <- ${key.padEnd(12)} src ${dur.toFixed(1)}s @${start.toFixed(1)}  ` +
    `out ${w}x${h} ${Number(outDur).toFixed(2)}s ${frames}f ${ok ? "OK" : "<-- WRONG"}`,
  );
}
