/**
 * Contact sheet of the shop's own product photography.
 *
 * Needed because several of these images carry baked-in annotations (a
 * "196mm x 149mm" dimension label) or styling that fights the film's palette
 * (a row of rainbow crayons). Those are invisible in a filename and only show
 * up when you look, so the closing plate gets chosen from a sheet rather than
 * from a plausible-sounding slug.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const IN = path.join(HERE, "public", "shots");
const T = path.join(HERE, "out", "_photos");
fs.rmSync(T, { recursive: true, force: true });
fs.mkdirSync(T, { recursive: true });

const FONT = "C\\:/Users/user/Desktop/aprojects/lebon-grace/remotion-launch/public/fonts/Karla.ttf";
const [BOXW, BOXH] = [300, 225];
const [W, H, COLS] = [306, 231, 6];

const files = fs.readdirSync(IN).filter((f) => f.endsWith(".png")).sort();

files.forEach((f, i) => {
  const vf = [
    `scale=${BOXW}:${BOXH}:force_original_aspect_ratio=decrease`,
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x111111`,
    `drawtext=fontfile='${FONT}':text='${i}':x=5:y=3:fontsize=24:fontcolor=yellow:box=1:boxcolor=black@0.8:boxborderw=4`,
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
  "-vf", `tile=${COLS}x${rows}:padding=3:color=0x222222`,
  "-frames:v", "1", "-q:v", "4",
  path.join(HERE, "out", "photos-sheet.jpg"),
]);

fs.writeFileSync(
  path.join(HERE, "out", "photos-index.json"),
  JSON.stringify(Object.fromEntries(files.map((f, i) => [i, f])), null, 2),
);
console.log(`${files.length} photos, ${COLS}x${rows}`);
