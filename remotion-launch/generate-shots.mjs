/**
 * Generate the two shots free stock could not provide, on fal.ai LTX-2.3 Fast.
 *
 * These are the laser cutting MDF and the name being engraved — the shots
 * SCRIPT-B calls "the film". 104 free-stock candidates were searched for those
 * two slots and every one was industrial metal fabrication, a laser light show,
 * or a bonfire.
 *
 * PROMPTS COME FROM docs/video/PROMPTS-playground.md, parsed, not retyped.
 * That file's prompts have the "On screen:" blocks stripped and carry "no
 * text, no captions" — which matters, because a Gemini run from the script doc
 * instead burned "Fraunces, ink #23201c" into frame one. The typography spec
 * got rendered as visible text. Parsing keeps the file that was designed to
 * avoid that as the thing actually being used.
 *
 * GENERATES ONLY. Nothing is wired into a film here. Every take gets frames
 * extracted for review first — the recurring lesson on this project is that a
 * plausible-sounding source is worthless until somebody looks at a frame.
 *
 * Usage: node generate-shots.mjs [--takes 3] [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fal } from "@fal-ai/client";

const run = promisify(execFile);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const DOC = path.join(HERE, "..", "docs", "video", "PROMPTS-playground.md");
const OUT = path.join(HERE, "..", ".ltx-takes");
fs.mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(
  fs.readFileSync("C:/Users/user/Desktop/aprojects/supabase.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
if (!env.FAL_API_KEY) throw new Error("FAL_API_KEY missing from supabase.local");
fal.config({ credentials: env.FAL_API_KEY });

const MODEL = "fal-ai/ltx-2.3/text-to-video/fast";
const RESOLUTION = "1080p";
const DURATION = 6;   // shortest the endpoint allows; both slots need <= 5.5s
const FPS = 24;       // no 30 option. 24 -> 30 is a clean 4:5 duplication in prep
/**
 * $/s, CONFIRMED AGAINST A REAL CHARGE.
 *
 * The model page contradicts itself: a "$0.06 per second for 1080p" billing
 * line above a "Resolutions and pricing" table quoting $0.04/s. Six 6-second
 * takes plus two short MMAudio beds predicted $2.17 at this rate and $1.45 at
 * $0.04; the fal balance moved $11.14 -> $8.96, i.e. $2.18.
 *
 * So the billing line is live and the table is stale. Budget $0.06.
 */
const RATE = 0.06;

/** Pull a named prompt out of the playground sheet. */
const promptFor = (file) => {
  const doc = fs.readFileSync(DOC, "utf8");
  // Headings look like:  ### `cut.mp4` — the laser cutting · 5s
  const head = doc.indexOf("`" + file + "`");
  if (head < 0) throw new Error(`${file}: no heading in PROMPTS-playground.md`);
  const open = doc.indexOf("```", head);
  const close = doc.indexOf("```", open + 3);
  if (open < 0 || close < 0) throw new Error(`${file}: no fenced prompt after its heading`);
  const text = doc.slice(open + 3, close).trim();
  if (text.length < 80) throw new Error(`${file}: prompt looks truncated (${text.length} chars)`);
  return text;
};

const SHOTS = ["cut.mp4", "name.mp4"];
const takes = Number(process.argv[process.argv.indexOf("--takes") + 1]) || 3;
const dry = process.argv.includes("--dry");

const jobs = SHOTS.flatMap((file) =>
  Array.from({ length: takes }, (_, i) => ({ file, take: i + 1, prompt: promptFor(file) })),
);

console.log(
  `${MODEL}\n${RESOLUTION}, ${DURATION}s, ${FPS}fps, no generated audio\n` +
  `${jobs.length} takes = ${jobs.length * DURATION}s ≈ $${(jobs.length * DURATION * RATE).toFixed(2)}\n`,
);
for (const s of SHOTS) console.log(`${s}: ${promptFor(s).slice(0, 90)}…`);
if (dry) process.exit(0);

/** Cap concurrency so a burst does not trip fal's queue. */
const pool = async (items, n, fn) => {
  const q = [...items];
  const out = [];
  await Promise.all(Array.from({ length: n }, async () => {
    for (let it = q.shift(); it; it = q.shift()) out.push(await fn(it));
  }));
  return out;
};

await pool(jobs, 3, async ({ file, take, prompt }) => {
  const name = `${file.replace(".mp4", "")}-t${take}`;
  const dest = path.join(OUT, `${name}.mp4`);
  if (fs.existsSync(dest)) { console.log(`${name}: cached`); return; }

  let res;
  try {
    res = await fal.subscribe(MODEL, {
      input: {
        prompt,
        resolution: RESOLUTION,
        duration: DURATION,
        aspect_ratio: "16:9",
        fps: FPS,
        // Default is TRUE. The films already carry their own foley and voice,
        // and a second audio bed underneath would fight both.
        generate_audio: false,
      },
    });
  } catch (e) {
    console.error(`${name}: FAILED — ${e?.message ?? e}`);
    return;
  }

  const url = res?.data?.video?.url ?? res?.video?.url;
  if (!url) { console.error(`${name}: no video url — ${JSON.stringify(res).slice(0, 200)}`); return; }

  const r = await fetch(url);
  if (!r.ok) { console.error(`${name}: download HTTP ${r.status}`); return; }
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));

  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,nb_frames:format=duration",
    "-of", "default=nw=1:nk=1", dest,
  ]);
  const [w, h, nf, dur] = stdout.trim().split(/\r?\n/);
  console.log(`${name}: ${w}x${h} ${Number(dur).toFixed(1)}s ${nf}f  ${(fs.statSync(dest).size / 1e6).toFixed(1)}MB`);
});

// One labelled contact sheet per shot, so all takes are judged side by side.
const FONT = "C\\:/Users/user/Desktop/aprojects/lebon-grace/remotion-launch/public/fonts/Karla.ttf";
for (const file of SHOTS) {
  const base = file.replace(".mp4", "");
  const cells = path.join(OUT, `_${base}`);
  fs.rmSync(cells, { recursive: true, force: true });
  fs.mkdirSync(cells, { recursive: true });

  let n = 0;
  for (let t = 1; t <= takes; t++) {
    const clip = path.join(OUT, `${base}-t${t}.mp4`);
    if (!fs.existsSync(clip)) continue;
    for (const frac of [0.2, 0.5, 0.8]) {
      const vf = [
        `scale=420:236:force_original_aspect_ratio=decrease`,
        `pad=426:242:(ow-iw)/2:(oh-ih)/2:color=0x111111`,
        `drawtext=fontfile='${FONT}':text='t${t} @${Math.round(frac * 100)}%':x=6:y=4:` +
        `fontsize=24:fontcolor=yellow:box=1:boxcolor=black@0.8:boxborderw=4`,
      ].join(",");
      await run("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", (DURATION * frac).toFixed(2), "-i", clip,
        "-vf", vf, "-frames:v", "1", "-q:v", "3",
        path.join(cells, `c-${String(n++).padStart(3, "0")}.jpg`),
      ]);
    }
  }
  if (!n) continue;
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-start_number", "0", "-i", path.join(cells, "c-%03d.jpg"),
    "-vf", `tile=3x${Math.ceil(n / 3)}:padding=4:color=0x222222`,
    "-frames:v", "1", "-q:v", "4",
    path.join(OUT, `${base}-sheet.jpg`),
  ]);
  console.log(`${base}-sheet.jpg: ${n} frames`);
}

console.log(`\nbilled ≈ $${(jobs.length * DURATION * RATE).toFixed(2)} at $${RATE}/s`);
console.log("Rate confirmed against a real charge: the page's $0.04/s table is stale, $0.06/s is live.");
