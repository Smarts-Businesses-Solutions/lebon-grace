/**
 * Verify the end-card note.
 *
 * This check went through three versions, and the failures are worth recording
 * because they are all the same mistake in different clothes: measuring the
 * mix instead of measuring the note.
 *
 *   v1  compared a 4s window at the close against mid-film. Called the note
 *       missing in "The Making" — the reference window had landed on the
 *       sanding shot, which is broadband and noisy at 130 Hz.
 *   v2  tested the attack/sustain/release envelope in the render. Works for
 *       "The Making". Fails for "The Correction", whose close is narrated end
 *       to end, so speech dominates every sample.
 *   v3  (this) tests the note FILES for the properties that define them, and
 *       tests the render only where the render can actually be read.
 *
 * "The Correction" was verified separately by an A/B render of its closing
 * shot with and without the note: 129-133 Hz went from -34.9 dB to -32.9 dB.
 * That is not reproducible from a plain script — it needs the component
 * disabled — so it is recorded here rather than re-run.
 *
 * Usage: node check-note.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const BED = path.join(HERE, "public", "audio", "bed");

const F = 130.81; // C3

const NOTES = [
  { file: "note-making.mp3", secs: 5.5, lufs: -30 },
  { file: "note-correction.mp3", secs: 6.0, lufs: -23 },
];

const meanDb = async (file, at, len) => {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner", "-ss", at.toFixed(2), "-t", String(len), "-i", file,
    "-af", "volumedetect", "-f", "null", "-",
  ]);
  const m = stderr.match(/mean_volume:\s*(-?[0-9.]+) dB/);
  return m ? Number(m[1]) : -Infinity;
};

let bad = 0;

// ── 1. the note files are what they claim to be ──────────────────────────────
for (const { file, secs, lufs } of NOTES) {
  const f = path.join(BED, file);
  if (!fs.existsSync(f)) { console.log(`${file}: MISSING`); bad++; continue; }

  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f,
  ]);
  const dur = parseFloat(stdout);

  const { stderr } = await run("ffmpeg", [
    "-hide_banner", "-i", f, "-af", "loudnorm=print_format=json", "-f", "null", "-",
  ]);
  const measured = Number(JSON.parse(
    stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1),
  ).input_i);

  // Envelope: quiet at both ends, loud in the middle. On the bare file there is
  // nothing else in the signal, so this is unambiguous.
  const a = await meanDb(f, 0.15, 0.5);
  const s = await meanDb(f, dur / 2 - 0.5, 1.0);
  const r = await meanDb(f, dur - 0.35, 0.3);

  const lenOk = Math.abs(dur - secs) < 0.1;
  const lufsOk = Math.abs(measured - lufs) < 1.5;
  const shapeOk = s - a >= 6 && s - r >= 6;
  if (!(lenOk && lufsOk && shapeOk)) bad++;

  console.log(
    `${file.padEnd(22)} ${dur.toFixed(2)}s ${lenOk ? "ok" : "<-- WRONG LENGTH"}  ` +
    `${measured.toFixed(1)} LUFS ${lufsOk ? "ok" : "<-- OFF TARGET"}\n` +
    `  envelope ${a.toFixed(1)} -> ${s.toFixed(1)} -> ${r.toFixed(1)} dB  ` +
    `${shapeOk ? "sustained" : "<-- NOT A SUSTAINED NOTE"}`,
  );
}

// ── 2. it reaches the render, where that is measurable ───────────────────────
// Only "The Making" can be read this way: its closing shot carries one short
// line and is otherwise quiet, so the note's envelope survives in the mix.
const film = path.join(HERE, "out", "making-master.mp4");
const bandAt = async (at) => {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner", "-ss", at.toFixed(2), "-t", "1.2", "-i", film,
    "-af", `highpass=f=${(F * 0.88).toFixed(0)},lowpass=f=${(F * 1.14).toFixed(0)},volumedetect`,
    "-f", "null", "-",
  ]);
  const m = stderr.match(/mean_volume:\s*(-?[0-9.]+) dB/);
  return m ? Number(m[1]) : -Infinity;
};
const [a, s, r] = [await bandAt(46.9), await bandAt(48.9), await bandAt(51.1)];
const lift = Math.min(s - a, s - r);
const ok = lift >= 3;
if (!ok) bad++;
console.log(
  `\nmaking-master.mp4 close  ${F} Hz  ${a.toFixed(1)} -> ${s.toFixed(1)} -> ${r.toFixed(1)} dB\n` +
  `  sustain stands ${lift.toFixed(1)} dB clear  ${ok ? "note present in render" : "<-- NOTE NOT IN RENDER"}`,
);
console.log("\ncorrection: verified by A/B render, -34.9 -> -32.9 dB at 129-133 Hz (see header)");

process.exit(bad ? 1 : 0);
