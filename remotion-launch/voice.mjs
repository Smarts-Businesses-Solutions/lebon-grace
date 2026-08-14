/**
 * Generate the voiceover, one file per line.
 *
 * ONE FILE PER LINE, not one long take. Each line then lands on an exact frame
 * in the timeline and cannot drift; a single take would have to be cut by ear
 * and would need re-cutting every time a shot length changes.
 *
 * The lines are placed so the voice NEVER RESTATES A CAPTION. That is the
 * failure mode with narration over typography: the viewer processes the same
 * sentence twice and the film feels padded. So the engraving and sanding shots,
 * whose captions already carry the point, have no voice over them at all, and
 * every line below adds something the type does not say.
 *
 * The colour-in beats are silent in the voice track for the same reason their
 * captions are blank: no copy on the site describes that version, so there is
 * nothing true to say over it yet.
 *
 * Usage: node voice.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(HERE, "public", "audio", "vo");
fs.mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(
  fs.readFileSync("C:/Users/user/Desktop/aprojects/supabase.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const KEY = env.OPENAI_API_KEY;
if (!KEY) throw new Error("OPENAI_API_KEY missing from supabase.local");

// gpt-4o-mini-tts takes a delivery instruction, which is the whole reason to
// use it here — "unhurried" is a direction, not a voice.
const MODEL = "gpt-4o-mini-tts";
const VOICE = "shimmer";
const INSTRUCTIONS = [
  "Warm, calm and unhurried. A real person describing their own work, not an advertisement.",
  "Speak slightly slower than conversational. Leave the ends of sentences alone — no upward lift, no sell.",
  "Never sound pleased with yourself. Plain and accurate is the whole tone.",
].join(" ");

/**
 * Lines are read from src/vo.ts, which the films also read — one source of
 * truth, so a re-timed line cannot move the audio without moving the picture.
 * Parsed with a regex rather than imported because this is a .mjs script and
 * that is a TypeScript module; check-cuts.mjs reads film data the same way.
 *
 * `slot` is derived: the frames until the NEXT line starts. A line running
 * across a picture cut is ordinary film grammar; a line running into the next
 * line is two people talking at once, and that is what this checks for.
 */
const parseVo = () => {
  const src = fs.readFileSync(path.join(HERE, "src", "vo.ts"), "utf8");
  const out = {};
  for (const film of ["making", "correction"]) {
    const block = src.slice(src.indexOf(`${film}: [`));
    const rows = [...block.slice(0, block.indexOf("\n  ],")).matchAll(
      /\{ id: "([^"]+)", frame: (\d+), text: "((?:[^"\\]|\\.)*)" \}/g,
    )].map((m) => ({ id: m[1], frame: Number(m[2]), text: m[3].replace(/\\"/g, '"') }));
    if (!rows.length) throw new Error(`no lines parsed for ${film}`);
    out[film] = rows.map((r, i) => [
      r.id, r.frame,
      (rows[i + 1]?.frame ?? r.frame + 90) - r.frame,
      r.text,
    ]);
  }
  return out;
};

/**
 * Lines, with the frame each one starts on (30fps).
 */
const LINES = parseVo();

const dry = process.argv.includes("--dry");
let chars = 0;
let over = 0;

for (const [film, lines] of Object.entries(LINES)) {
  console.log(`\n=== ${film} ===`);
  for (const [id, frame, slot, text] of lines) {
    chars += text.length;
    const dest = path.join(OUT, `${film}-${id}.mp3`);

    if (!dry && !fs.existsSync(dest)) {
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL, voice: VOICE, input: text,
          instructions: INSTRUCTIONS, response_format: "mp3",
        }),
      });
      if (!r.ok) throw new Error(`${id}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    }

    if (dry) { console.log(`  ${id} @${frame} "${text}"`); continue; }

    const { stdout } = await run("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", dest,
    ]);
    const secs = parseFloat(stdout.trim());
    const frames = Math.ceil(secs * 30);
    const fits = frames <= slot;
    if (!fits) over++;
    console.log(
      `  ${id} @${String(frame).padStart(4)}  ${secs.toFixed(2)}s ${String(frames).padStart(3)}f ` +
      `/ ${String(slot).padStart(3)}f  ${fits ? "fits" : "<-- OVERRUNS"}  "${text}"`,
    );
  }
}

console.log(`\n${chars} characters total`);
if (!dry) console.log(over ? `${over} line(s) overrun their slot` : "every line fits its slot");
