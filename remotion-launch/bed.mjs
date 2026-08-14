/**
 * Generate the sound bed, one file per distinct clip, with fal.ai MMAudio v2.
 *
 * MMAudio is video-to-audio: it takes the actual clip plus a text prompt and
 * returns foley matched to what is on screen. That is why it is worth the
 * upload round-trip over a text-only generator — the sanding rhythm lands on
 * the actual sanding, and the tape tears when the hands tear it.
 *
 * ONE BED PER SOURCE CLIP, not per shot. Both films draw on the same pool, so
 * `sand.mp4` needs one bed that serves The Making's shot 6 and The Correction's
 * shot 5. Beds are trimmed per-shot in the timeline instead.
 *
 * Cost: $0.001/sec. The nine clips total ~50s, so about five cents.
 *
 * Usage: node bed.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fal } from "@fal-ai/client";

const run = promisify(execFile);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const STOCK = path.join(HERE, "public", "stock");
const OUT = path.join(HERE, "public", "audio", "bed");
fs.mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(
  fs.readFileSync("C:/Users/user/Desktop/aprojects/supabase.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
if (!env.FAL_API_KEY) throw new Error("FAL_API_KEY missing from supabase.local");
fal.config({ credentials: env.FAL_API_KEY });

/**
 * clip -> the sound that clip should make.
 *
 * Every prompt ends with the same two constraints. "No music" because both
 * scripts are explicit that music does not enter until the final card, and
 * these models reach for a score unless told not to. "No voices" because the
 * voiceover occupies that space and a murmuring crowd underneath it is the
 * fastest way to make a quiet film sound cheap.
 */
const TAIL = "Quiet, close, realistic room sound. No music. No voices, no speech, no singing.";

/** [output name, prompt, source clip to watch — defaults to the output name]. */
const BEDS = [
  // Looped under the entire film beneath the per-shot foley. Without it the
  // product plates — which have no foley of their own — drop to digital
  // silence, and a hard cut to nothing reads as a broken file.
  //
  // Generated against `order` because MMAudio needs a video to watch and there
  // is no "empty room" clip; the prompt, not the picture, is doing the work.
  ["room",    `The empty air of a quiet indoor room. Barely audible ambience, a faint low hum, nothing happening at all. ${TAIL}`, "order"],
  ["order",   `A quiet workshop room. Soft fingers on a laptop keyboard, unhurried. Faint distant hum. ${TAIL}`],
  ["sheet",   `A large sheet of wood being carried and set down flat on a metal machine bed, a low wooden knock. Airy empty workshop. ${TAIL}`],
  ["inspect", `Hands moving flat timber on a wooden bench, light wooden knocks and a soft scrape. ${TAIL}`],
  // These two now watch generated laser footage, not a wood router, so the
  // prompts changed with them — a router's whirr under a laser reads wrong.
  ["cut",     `A CO2 laser cutter working wood: a steady low hum, a fine hiss where the beam meets the board, an extraction fan running softly. ${TAIL}`],
  ["name",    `A laser engraving letters into a wooden board: short bursts of fine hiss as each stroke is burned, a low machine hum between them. ${TAIL}`],
  ["lift",    `Wooden pieces being picked up and set down on a workbench, light knocks, a soft brush of sawdust. ${TAIL}`],
  ["sand",    `Sandpaper on wood, slow rhythmic back-and-forth strokes, close and dry. ${TAIL}`],
  ["pack",    `Cardboard being folded, then a strip of paper tape pulled and smoothed flat by hand. ${TAIL}`],
  ["play",    `Small wooden puzzle pieces handled and clicked into a wooden board on a table. Quiet room. ${TAIL}`],
  ["colour",  `A crayon and a marker pen drawing on paper, soft strokes, a pencil rolling on a wooden desk. ${TAIL}`],
];

const dry = process.argv.includes("--dry");
let seconds = 0;

for (const [name, prompt, from] of BEDS) {
  const src = path.join(STOCK, `${from ?? name}.mp4`);
  const dest = path.join(OUT, `${name}.mp3`);

  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", src,
  ]);
  const dur = parseFloat(stdout.trim());
  seconds += dur;

  if (dry) { console.log(`${name.padEnd(8)} ${dur.toFixed(1)}s  ${prompt.slice(0, 60)}…`); continue; }
  if (fs.existsSync(dest)) { console.log(`${name.padEnd(8)} cached`); continue; }

  // Upload the clip so MMAudio can watch it, then generate against it.
  const url = await fal.storage.upload(new Blob([fs.readFileSync(src)], { type: "video/mp4" }));
  const res = await fal.subscribe("fal-ai/mmaudio-v2", {
    input: { video_url: url, prompt, duration: Math.min(30, Math.ceil(dur)) },
  });

  const outUrl = res?.data?.video?.url ?? res?.video?.url;
  if (!outUrl) throw new Error(`${name}: no video in response — ${JSON.stringify(res).slice(0, 300)}`);

  // MMAudio returns the video with its new audio layer; keep only the audio.
  const tmp = path.join(OUT, `${name}.tmp.mp4`);
  const r = await fetch(outUrl);
  if (!r.ok) throw new Error(`${name}: download HTTP ${r.status}`);
  fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));

  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", tmp, "-vn", "-c:a", "libmp3lame", "-q:a", "3", dest,
  ]);
  fs.unlinkSync(tmp);

  const probe = await run("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_type:format=duration",
    "-of", "default=nw=1:nk=1", dest,
  ]);
  console.log(`${name.padEnd(8)} ${dur.toFixed(1)}s video -> ${probe.stdout.trim().split(/\r?\n/).join(" ")}`);
}

console.log(`\n${seconds.toFixed(0)}s of audio ≈ $${(seconds * 0.001).toFixed(3)}`);
