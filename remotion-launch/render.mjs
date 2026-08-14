// Render the launch films.
//
// WHY THIS FILE WAS REWRITTEN (2026-08-14)
// What was here before was a BYTE-IDENTICAL copy of
// heartleigh-web/remotion-products/render.mjs. It called
// selectComposition({ id: "ProductCard" }) -- a composition that only exists in
// heartleigh. This project registers MakingMaster, MakingVertical,
// CorrectionMaster, CorrectionVertical, LaunchMaster, LaunchVertical,
// EndCard720 and Thumb169, so the script threw before rendering a single frame.
//
// It was not harmless dead code: package.json still wires `npm run render` to
// it, so the one obvious command in this folder failed for a reason that looked
// like a Remotion problem rather than a copied file.
//
// Deleting it would have left `npm run render` pointing at nothing, so it is
// rewritten instead -- rendering exactly the four outputs the README documents,
// in the same order and to the same paths, so the file and the docs cannot
// drift apart.
//
//   npm run render            all four
//   node render.mjs Making    just the two Making cuts
//
// The README's four `npx remotion render` lines remain the source of truth and
// still work on their own; this is a convenience wrapper over them, not a
// second way of doing it.
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, ensureBrowser } from "@remotion/renderer";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Kept in lockstep with README "## Render". If you add a film, add it here.
const TARGETS = [
  { id: "MakingMaster", out: "making-master.mp4" },
  { id: "MakingVertical", out: "making-vertical.mp4" },
  { id: "CorrectionMaster", out: "correction-master.mp4" },
  { id: "CorrectionVertical", out: "correction-vertical.mp4" },
];

const filter = process.argv[2];
const wanted = filter
  ? TARGETS.filter((t) => t.id.toLowerCase().includes(filter.toLowerCase()))
  : TARGETS;

if (wanted.length === 0) {
  console.error(
    `No composition matches "${filter}". Known: ${TARGETS.map((t) => t.id).join(", ")}`,
  );
  process.exit(2);
}

await ensureBrowser();
await mkdir(path.resolve(HERE, "out"), { recursive: true });

// Bundle once and reuse it. Bundling per composition is the slow, obvious
// mistake here: it is the same entry point every time.
const serveUrl = await bundle({ entryPoint: path.resolve(HERE, "src", "index.ts") });

for (const { id, out } of wanted) {
  // selectComposition throws if the id is absent -- which is exactly how the
  // previous version of this file failed, silently looking like a render bug.
  // Name the composition in the error so the next person sees it immediately.
  let composition;
  try {
    composition = await selectComposition({ serveUrl, id });
  } catch (e) {
    console.error(
      `composition "${id}" is not registered in src/index.ts — ` +
        `known ids are ${TARGETS.map((t) => t.id).join(", ")}`,
    );
    throw e;
  }

  const outputLocation = path.resolve(HERE, "out", out);
  console.log(`rendering ${id} -> out/${out}`);
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    pixelFormat: "yuv420p",
    outputLocation,
  });
}

console.log(
  `done: ${wanted.length} of ${TARGETS.length} film(s). ` +
    `Now run the checks before shipping: node check-cuts.mjs && node check-audio.mjs && node check-note.mjs`,
);
