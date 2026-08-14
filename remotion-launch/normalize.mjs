/**
 * Loudness-normalise every audio file to a fixed target, two-pass.
 *
 * WHY THIS EXISTS: nobody involved in building this can hear the mix. Setting
 * `volume={0.3}` in Remotion by guesswork produces a film where the voice is
 * buried or the foley is deafening, and neither is discoverable without ears.
 *
 * Normalising each file to a measured LUFS target instead makes the balance
 * correct by construction: the voice sits ~12 LU above the foley and ~20 above
 * the room tone, which is a conventional speech-over-ambience mix. Remotion
 * then plays everything at volume 1 and the levels are already right.
 *
 * Two-pass because one-pass loudnorm is a dynamic estimate; on files this short
 * it drifts badly. Pass one measures, pass two applies the measurement.
 *
 * Idempotent: writes a .normalized marker so re-running does not
 * re-normalise already-normalised audio down to nothing.
 *
 * Usage: node normalize.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const AUDIO = path.join(HERE, "public", "audio");

/** Integrated loudness targets, in LUFS. */
const TARGETS = {
  vo: -16,    // speech, conventional for web video
  bed: -28,   // foley: clearly present, clearly underneath
  room: -38,  // room tone: felt, not heard
};
const TRUE_PEAK = -1.5;

const marker = path.join(AUDIO, ".normalized");
const done = fs.existsSync(marker)
  ? new Set(fs.readFileSync(marker, "utf8").split(/\r?\n/).filter(Boolean))
  : new Set();

/** Measured integrated loudness of a file, in LUFS. */
const measure = async (file) => {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner", "-i", file,
    "-af", "loudnorm=print_format=json", "-f", "null", "-",
  ]);
  const json = stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1);
  return JSON.parse(json);
};

const files = [];
for (const dir of ["vo", "bed"]) {
  const d = path.join(AUDIO, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith(".mp3"))) {
    const kind = dir === "vo" ? "vo" : f === "room.mp3" ? "room" : "bed";
    files.push({ kind, file: path.join(d, f), rel: `${dir}/${f}` });
  }
}

for (const { kind, file, rel } of files) {
  if (done.has(rel)) { console.log(`${rel.padEnd(22)} already normalised`); continue; }

  const target = TARGETS[kind];
  const m = await measure(file);
  const before = Number(m.input_i);

  const tmp = file.replace(/\.mp3$/, ".norm.mp3");
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", file,
    "-af",
    `loudnorm=I=${target}:TP=${TRUE_PEAK}:LRA=11:` +
    `measured_I=${m.input_i}:measured_TP=${m.input_tp}:` +
    `measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:` +
    `offset=${m.target_offset}:linear=true`,
    "-c:a", "libmp3lame", "-q:a", "2", tmp,
  ]);
  fs.renameSync(tmp, file);

  const after = Number((await measure(file)).input_i);
  done.add(rel);
  console.log(
    `${rel.padEnd(22)} ${kind.padEnd(4)} ${before.toFixed(1)} -> ${after.toFixed(1)} LUFS ` +
    `(target ${target})  ${Math.abs(after - target) < 1.5 ? "ok" : "<-- OFF TARGET"}`,
  );
}

fs.writeFileSync(marker, [...done].join("\n"));
console.log(`\n${files.length} files; voice sits ${TARGETS.bed - TARGETS.vo} LU above foley, ` +
            `${TARGETS.room - TARGETS.vo} LU above room tone`);
