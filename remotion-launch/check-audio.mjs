/**
 * Verify the final mix without listening to it.
 *
 * Nobody who built this mix can hear it, so "it sounds fine" is not available
 * as a check. These are the things that can be measured instead, and they cover
 * the failures that actually happen:
 *
 *   1. a silent track            — the audio never got wired in
 *   2. a dead stretch            — a shot with no bed, or the room tone loop
 *                                  running out partway through
 *   3. clipping                  — layers summing past 0 dBFS
 *   4. loudness far off platform — YouTube/LinkedIn normalise to about -14
 *
 * Usage: node check-audio.mjs
 */
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const FILMS = [
  "out/making-master.mp4",
  "out/making-vertical.mp4",
  "out/correction-master.mp4",
  "out/correction-vertical.mp4",
];

/** Integrated loudness and true peak of the whole file. */
const loudness = async (file) => {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner", "-i", file, "-af", "loudnorm=print_format=json", "-f", "null", "-",
  ]);
  const j = JSON.parse(stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1));
  return { lufs: Number(j.input_i), peak: Number(j.input_tp) };
};

/**
 * Mean volume per window, to find dead stretches.
 *
 * A window quieter than the room tone floor means nothing is playing there at
 * all — which is the symptom of a bed that failed to load, not of a quiet shot.
 */
const windows = async (file, dur, size = 5) => {
  const out = [];
  for (let t = 0; t < dur; t += size) {
    const { stderr } = await run("ffmpeg", [
      "-hide_banner", "-ss", String(t), "-t", String(Math.min(size, dur - t)),
      "-i", file, "-af", "volumedetect", "-f", "null", "-",
    ]);
    const m = stderr.match(/mean_volume:\s*(-?[0-9.]+) dB/);
    out.push({ t, mean: m ? Number(m[1]) : -Infinity });
  }
  return out;
};

// Room tone is normalised to -38 LUFS, so any window quieter than -60 dB mean
// has genuinely nothing in it.
const DEAD = -60;
let bad = 0;

for (const rel of FILMS) {
  const file = path.join(HERE, rel);
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file,
  ]);
  const dur = parseFloat(stdout.trim());
  const { lufs, peak } = await loudness(file);
  const w = await windows(file, dur);
  const dead = w.filter((x) => x.mean <= DEAD);
  const quietest = w.reduce((a, b) => (a.mean < b.mean ? a : b));

  const clips = peak > -0.5;
  if (dead.length || clips) bad++;

  console.log(
    `\n${rel}\n` +
    `  ${dur.toFixed(1)}s  integrated ${lufs.toFixed(1)} LUFS  true peak ${peak.toFixed(1)} dBTP` +
    `${clips ? "  <-- CLIPPING" : ""}\n` +
    `  quietest 5s window: ${quietest.mean.toFixed(1)} dB at ${quietest.t}s` +
    `${dead.length ? `\n  <-- ${dead.length} DEAD WINDOW(S): ${dead.map((d) => d.t + "s").join(", ")}` : "  (no dead stretches)"}`,
  );
}

console.log(bad ? `\n${bad} file(s) have problems` : "\nall four mixes are continuous and do not clip");
process.exit(bad ? 1 : 0);
