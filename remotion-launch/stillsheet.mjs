/**
 * Tile the review stills into one labelled sheet.
 *
 * Reviewing nine 1920x1080 PNGs one at a time is slow and makes it hard to
 * judge whether the shots cut together — which is the whole question a grade
 * and a shot order have to answer. One sheet shows the film as a strip.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const IN = path.join(HERE, "out", "stills");
const T = path.join(IN, "_n");
fs.rmSync(T, { recursive: true, force: true });
fs.mkdirSync(T, { recursive: true });

const FONT = "C\\:/Users/user/Desktop/aprojects/lebon-grace/remotion-launch/public/fonts/Karla.ttf";
// Pad canvas strictly larger than the scale box — pad refuses a target equal to
// its input, and a 16:9 still scales to exactly the box.
const [BOXW, BOXH] = [560, 315];
const [W, H, COLS] = [566, 321, 3];

const files = fs.readdirSync(IN)
  .filter((f) => f.endsWith(".png"))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

files.forEach((f, i) => {
  const frame = f.match(/\d+/)[0];
  const vf = [
    `scale=${BOXW}:${BOXH}:force_original_aspect_ratio=decrease`,
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x111111`,
    `drawtext=fontfile='${FONT}':text='shot ${i + 1} · f${frame}':x=8:y=6:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.8:boxborderw=5`,
  ].join(",");
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", path.join(IN, f), "-vf", vf,
    "-frames:v", "1", "-q:v", "3",
    path.join(T, `c-${String(i).padStart(3, "0")}.jpg`),
  ]);
});

const rows = Math.ceil(files.length / COLS);
execFileSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-start_number", "0", "-i", path.join(T, "c-%03d.jpg"),
  "-vf", `tile=${COLS}x${rows}:padding=4:color=0x222222`,
  "-frames:v", "1", "-q:v", "4",
  path.join(HERE, "out", "stills-sheet.jpg"),
]);

console.log(`${files.length} stills, ${COLS}x${rows}: ${files.join(" ")}`);
