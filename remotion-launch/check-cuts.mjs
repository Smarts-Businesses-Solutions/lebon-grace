/**
 * Assert that no shot boundary in either film dips to black.
 *
 * The first cut of "The Making" put a fully black frame at every clip boundary,
 * because two non-overlapping Sequences each faded at their own edges. It was
 * invisible in a spot check and obvious in motion. This walks EVERY boundary in
 * both films and measures the actual luminance of the frames either side, so
 * the defect cannot come back unnoticed.
 *
 * Usage: node check-cuts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

/** Read the shot lengths straight from the film data, so this cannot drift. */
const framesOf = (file) =>
  [...fs.readFileSync(path.join(HERE, "src", file), "utf8").matchAll(/frames: (\d+)/g)]
    .map((m) => Number(m[1]));

const FILMS = [
  { name: "making", video: "out/making-master.mp4", shots: framesOf("making.ts") },
  { name: "correction", video: "out/correction-master.mp4", shots: framesOf("correction.ts") },
];

/** Mean luma of one frame, 0-255, via signalstats. */
const luma = async (video, n) => {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner", "-v", "info", "-nostats",
    "-i", path.join(HERE, video),
    "-vf", `select='eq(n\\,${n})',signalstats,metadata=print:key=lavfi.signalstats.YAVG`,
    "-vsync", "0", "-frames:v", "1", "-f", "null", "-",
  ]);
  const m = stderr.match(/YAVG=([0-9.]+)/);
  if (!m) throw new Error(`no YAVG for frame ${n}`);
  return Number(m[1]);
};

// Anything this dark on a cream film is a fault, not a look. The failing
// frames measured ~16; every good frame here measures well above 100.
const FLOOR = 40;

let bad = 0;
for (const film of FILMS) {
  let at = 0;
  const cuts = [];
  for (const f of film.shots.slice(0, -1)) { at += f; cuts.push(at); }

  console.log(`\n${film.name}: ${film.shots.length} shots, ${cuts.length} boundaries`);
  for (const c of cuts) {
    const [before, on, after] = await Promise.all([luma(film.video, c - 1), luma(film.video, c), luma(film.video, c + 1)]);
    const min = Math.min(before, on, after);
    const ok = min >= FLOOR;
    if (!ok) bad++;
    console.log(
      `  cut @${String(c).padStart(4)}  ${before.toFixed(0).padStart(3)} ${on.toFixed(0).padStart(3)} ${after.toFixed(0).padStart(3)}` +
      `   ${ok ? "ok" : "<-- DIPS TO BLACK"}`,
    );
  }
}

console.log(bad ? `\n${bad} boundary(ies) dip to black` : "\nno boundary dips to black");
process.exit(bad ? 1 : 0);
