/**
 * Generate shots locally on ComfyUI + LTX-Video 2B. Free, unlimited takes.
 *
 * Builds the workflow in API form and queues it against a running ComfyUI, then
 * converts the result to the 1920x1080 / 30fps mp4 the films expect and pulls a
 * contact sheet for review.
 *
 * Every constant below was read off the live server's /object_info rather than
 * copied from a tutorial — node names, the "ltxv" CLIP type, the 32-pixel
 * dimension step, the 8n+1 frame count and the vp9 codec are all things ComfyUI
 * validates and rejects.
 *
 * Prompts come from docs/video/PROMPTS-playground.md, parsed. Same source the
 * paid run used, so a prompt fix improves both paths at once.
 *
 * Usage:
 *   node ltx-local.mjs cut.mp4 --takes 3
 *   node ltx-local.mjs name.mp4 --takes 5 --width 1920 --height 1088
 *   node ltx-local.mjs --list
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const DOC = path.join(HERE, "..", "docs", "video", "PROMPTS-playground.md");
const OUT = path.join(HERE, "..", ".ltx-takes");
const HOST = process.env.COMFY_HOST || "http://127.0.0.1:8188";

const CKPT = "ltxv-2b-0.9.8-distilled.safetensors";
const T5 = "t5xxl_fp8_e4m3fn_scaled.safetensors";

const arg = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

/**
 * Defaults sized for 16GB of VRAM.
 *
 * 1216x704 is LTX's standard near-16:9 tile; both sides divide by 32, which the
 * node requires. 1920x1088 also divides by 32 and runs on this card.
 *
 * MEASURED, SO DO NOT RE-RUN THE EXPERIMENT: 1216x704 at 8 steps takes 47s;
 * 1920x1088 at 25 steps takes 323s. The 7x spend bought sharper pixels and
 * changed nothing about content — both produced planked pine with knots, no
 * smoke and no visible cutting, against a prompt that explicitly forbids all
 * three.
 *
 * That is this checkpoint's ceiling, not a settings problem. LTX-Video 2B is a
 * small distilled model; the fal run that produced a usable laser was LTX-2.3
 * at 22B. Raising steps or resolution here will not close that gap — a bigger
 * checkpoint or a different model would. Keep the fast defaults for iteration.
 */
const WIDTH = Number(arg("--width", 1216));
const HEIGHT = Number(arg("--height", 704));
/** 8n+1. 145 frames = 6.04s at 24fps, matching the paid run's clip length. */
const LENGTH = Number(arg("--length", 145));
const FPS = 24;
/** The distilled checkpoint is trained for few steps and no CFG. */
const STEPS = Number(arg("--steps", 8));
const CFG = Number(arg("--cfg", 1.0));

const readDoc = () => fs.readFileSync(DOC, "utf8");

/** Pull a named prompt out of the playground sheet. */
const promptFor = (file) => {
  const doc = readDoc();
  const head = doc.indexOf("`" + file + "`");
  if (head < 0) throw new Error(`${file}: no heading in PROMPTS-playground.md`);
  const open = doc.indexOf("```", head);
  const close = doc.indexOf("```", open + 3);
  const text = doc.slice(open + 3, close).trim();
  if (text.length < 80) throw new Error(`${file}: prompt looks truncated`);
  return text;
};

/** The shared negative prompt, so local runs reject the same failures. */
const negative = () => {
  const doc = readDoc();
  const head = doc.indexOf("### Negative prompt");
  const open = doc.indexOf("```", head);
  const close = doc.indexOf("```", open + 3);
  return doc.slice(open + 3, close).trim().replace(/\s+/g, " ");
};

if (process.argv.includes("--list")) {
  const names = [...readDoc().matchAll(/^### `([a-z]+\.mp4)`/gm)].map((m) => m[1]);
  console.log("prompts available:", [...new Set(names)].join(", "));
  process.exit(0);
}

const shot = process.argv[2];
if (!shot || shot.startsWith("--")) throw new Error("pass a shot, e.g. cut.mp4 (see --list)");
const takes = Number(arg("--takes", 3));

/** The workflow, in the API form /prompt accepts. */
const workflow = (positive, seed) => ({
  "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
  "2": { class_type: "CLIPLoader", inputs: { clip_name: T5, type: "ltxv" } },
  "3": { class_type: "CLIPTextEncode", inputs: { text: positive, clip: ["2", 0] } },
  "4": { class_type: "CLIPTextEncode", inputs: { text: negative(), clip: ["2", 0] } },
  "5": { class_type: "EmptyLTXVLatentVideo",
         inputs: { width: WIDTH, height: HEIGHT, length: LENGTH, batch_size: 1 } },
  // LTXVConditioning stamps the frame rate onto the conditioning; the model is
  // rate-aware and drifts if this disagrees with the SaveWEBM fps.
  "6": { class_type: "LTXVConditioning",
         inputs: { positive: ["3", 0], negative: ["4", 0], frame_rate: FPS } },
  "7": { class_type: "KSampler",
         inputs: { model: ["1", 0], seed, steps: STEPS, cfg: CFG,
                   sampler_name: "euler", scheduler: "simple",
                   positive: ["6", 0], negative: ["6", 1],
                   latent_image: ["5", 0], denoise: 1.0 } },
  "8": { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: ["1", 2] } },
  "9": { class_type: "SaveWEBM",
         inputs: { images: ["8", 0], filename_prefix: `lebon-grace/${shot.replace(".mp4", "")}`,
                   codec: "vp9", fps: FPS, crf: 18 } },
});

const post = async (p, body) => {
  const r = await fetch(HOST + p, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status} ${t.slice(0, 400)}`);
  return JSON.parse(t);
};

fs.mkdirSync(OUT, { recursive: true });
const positive = promptFor(shot);
const base = shot.replace(".mp4", "");

console.log(`${HOST}  ${CKPT}`);
console.log(`${WIDTH}x${HEIGHT}  ${LENGTH}f @${FPS}fps (${(LENGTH / FPS).toFixed(2)}s)  steps=${STEPS} cfg=${CFG}`);
console.log(`${takes} take(s) of ${shot}\n`);

for (let t = 1; t <= takes; t++) {
  // Seed varies per take; there is no seed input on the endpoint used for the
  // paid run, so this is the one place local generation is more controllable.
  const seed = Math.floor(1e6 + t * 7919 + Date.parse("2026-08-14") % 1e6);
  const started = Date.now();

  const { prompt_id } = await post("/prompt", { prompt: workflow(positive, seed) });
  process.stdout.write(`  take ${t} queued (${prompt_id.slice(0, 8)})`);

  // Poll history rather than the websocket — one fewer moving part, and these
  // runs are minutes long so a 2s poll costs nothing.
  let outputs = null;
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const h = await (await fetch(`${HOST}/history/${prompt_id}`)).json();
    const entry = h[prompt_id];
    if (!entry) { process.stdout.write("."); continue; }
    if (entry.status?.status_str === "error") {
      console.log(`\n  take ${t}: FAILED — ${JSON.stringify(entry.status.messages).slice(0, 300)}`);
      break;
    }
    if (entry.outputs && Object.keys(entry.outputs).length) { outputs = entry.outputs; break; }
  }
  if (!outputs) continue;

  const file = Object.values(outputs).flatMap((o) => o.images ?? o.gifs ?? o.videos ?? [])[0];
  if (!file) { console.log(`\n  take ${t}: no output file in history`); continue; }

  const q = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder ?? "", type: file.type ?? "output" });
  const webm = path.join(OUT, `${base}-local-t${t}.webm`);
  const buf = Buffer.from(await (await fetch(`${HOST}/view?${q}`)).arrayBuffer());
  fs.writeFileSync(webm, buf);

  // Convert to what prep-stock.mjs expects: h264 mp4, 1920x1080, 30fps.
  const mp4 = webm.replace(/\.webm$/, ".mp4");
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", webm,
    "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30",
    "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", mp4,
  ]);
  fs.unlinkSync(webm);

  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(` -> ${path.basename(mp4)}  ${(fs.statSync(mp4).size / 1e6).toFixed(1)}MB  ${secs}s`);
}

// Contact sheet across every local take, same review habit as the paid run.
const clips = fs.readdirSync(OUT).filter((f) => f.startsWith(`${base}-local-t`) && f.endsWith(".mp4")).sort();
if (clips.length) {
  const cells = path.join(OUT, `_${base}-local`);
  fs.rmSync(cells, { recursive: true, force: true });
  fs.mkdirSync(cells, { recursive: true });
  const FONT = "C\\:/Users/user/Desktop/aprojects/lebon-grace/remotion-launch/public/fonts/Karla.ttf";
  let n = 0;
  for (const c of clips) {
    for (const frac of [0.2, 0.5, 0.8]) {
      await run("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", ((LENGTH / FPS) * frac).toFixed(2), "-i", path.join(OUT, c),
        "-vf", [
          "scale=420:236:force_original_aspect_ratio=decrease",
          "pad=426:242:(ow-iw)/2:(oh-ih)/2:color=0x111111",
          `drawtext=fontfile='${FONT}':text='${c.match(/t(\d+)/)[0]} @${Math.round(frac * 100)}%':` +
          `x=6:y=4:fontsize=24:fontcolor=yellow:box=1:boxcolor=black@0.8:boxborderw=4`,
        ].join(","),
        "-frames:v", "1", "-q:v", "3", path.join(cells, `c-${String(n++).padStart(3, "0")}.jpg`),
      ]);
    }
  }
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-start_number", "0", "-i", path.join(cells, "c-%03d.jpg"),
    "-vf", `tile=3x${Math.ceil(n / 3)}:padding=4:color=0x222222`,
    "-frames:v", "1", "-q:v", "4", path.join(OUT, `${base}-local-sheet.jpg`),
  ]);
  console.log(`\n${base}-local-sheet.jpg: ${n} frames from ${clips.length} take(s)`);
}

console.log("\nlocal generation costs nothing — rerun with more --takes until the letters are right");
