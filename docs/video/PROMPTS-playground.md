# Generation prompts — both films, copy-paste, one per clip

For any text-to-video tool: ComfyUI, Veo/Gemini, Sora, Kling, Runway, LTX, MiniMax.

**Every prompt is standalone.** The style block is written into each one, because
video models remember nothing between generations — two prompts sharing a "see
above" style note come back looking like two different films.

---

## Read this first: what went wrong last time

These prompts have been revised against two real runs. The failures were all
predictable in hindsight and all cost money, so they are written into the
prompts now rather than left to be rediscovered.

**1. The material came out as planked timber, not MDF — and the prompt caused it.**
LTX rendered pine with strong grain and visible planks. Real MDF is an
*engineered* board: uniform, grainless, no knots, no plank seams. It looks like
the product photographs.

The root cause was a contradiction in the prompt itself. It asked for a
**"wooden puzzle"** and then for **"no wood grain, no planks, no knots"** — and
every model tested resolved that by rendering timber. The word "wooden" was
doing more work than the three negations undoing it.

**The product is natural raw MDF, never "wooden".** Every prompt below now says
"natural raw MDF" or "engineered fibreboard" and the word "wooden" appears only
where it is genuinely correct — a workbench, a desk. The catalogue agrees:
`material: "3mm MDF, sanded by hand"` on all 41 products.

If a take still comes back as timber, look for the word "wood" in the prompt
before blaming the model.

**2. Letters came out as gibberish, two takes in three.**
The engraving shot is the hardest thing here. Of three takes, one produced a
real name ("LUCY") and two produced convincing-looking nonsense. This is what
generative models do to text.
- Ask for a **short name, 3–4 letters**, in quotes.
- Expect to discard most takes. Budget 3–5 for this shot alone.
- If a tool keeps failing, frame tighter so only **two or three letters** are
  in shot at once — fewer characters, fewer chances to garble.

**3. Machines came back with writing on them.**
One take rendered "CO2" on the laser head, because the prompt said "CO2 laser".
Say the machine type, then forbid labels.

**4. Gemini burned the captions into the picture.**
A run from `SCRIPT-A` rendered `This puzzle is in stock.` *and*
`Fraunces, ink #23201c` — the typography spec — as on-screen text. **Use this
file, never the script docs.** The prompts here have the `On screen:` blocks
stripped, and every one ends in "no text".

---

## Universal settings

**Aspect ratio 16:9.** The vertical cuts are re-laid-out in Remotion from the
same masters, never generated separately.

**Resolution 1080p.** The masters are 1920×1080. A 720p source upscales soft on
exactly the macro detail these shots exist for.

**Duration:** generate at least the length listed plus ~1s of margin.
`prep-stock.mjs` trims to a centred segment of the exact length the edit needs,
and a source shorter than its slot silently holds its last frame.

**Frame rate:** 24fps is fine — `prep-stock.mjs` converts to 30. Prefer 24 over
25 if offered: 24→30 is a clean 4:5 duplication, 25→30 is not.

**Audio: off.** Both films carry their own foley, voice and end note. A second
generated bed underneath fights all three.

### Negative prompt — paste every time

```
sparks, molten metal, welding, metal sheet, CNC plasma, angle grinder,
wood grain, planks, knots, timber boards, varnish, gloss, dark walnut,
painted wood, text, letters, captions, subtitles, watermark, logo, brand name,
label on machine, misspelled text, gibberish text, faces, child's face,
teal and orange grade, high contrast, lens flare, factory floor, assembly line
```

---

# Priority: the two shots that do not exist in stock

104 free-stock candidates were searched for these two and not one was usable —
everything was industrial metal fabrication, laser light shows, or bonfires.
These are the shots SCRIPT-B calls "the film". If you generate nothing else,
generate these.

### `cut.mp4` — the laser cutting · 5s

```
Extreme macro shot of a laser cutter head slowly tracing a smooth curved outline
through a flat sheet of natural raw MDF. The board is engineered fibreboard:
a completely uniform, matte, grainless tan surface with no wood grain, no planks,
no knots. A thin ribbon of pale grey smoke rises steadily from the cut line and
drifts slowly to the left. A small soft amber glow at the single point of contact.
The dark machine gantry sits above, out of focus, with no writing, labels or logos
on it. The scorched dark edge of the cut is visible in the board. Slow lateral
tracking shot, extremely shallow depth of field, the cut line sharp and everything
else soft. A small quiet workshop, not a factory. Warm neutral palette, cream and
oat tones, soft natural daylight, calm documentary feel. No sparks of any kind —
cutting wood makes smoke, never sparks. No text anywhere in frame.
```

### `name.mp4` — the name being engraved · 6s

```
Extreme macro of a laser engraving the short name "LUCY" into light honey-toned
MDF, the four letters appearing one at a time from left to right in a simple
serif. The board is engineered fibreboard: uniform, matte, grainless tan, with no
wood grain, no planks, no knots. Faint pale smoke curls upward from each stroke
as it burns. A soft amber glow at the point of contact. The darkened scorched
edge of each finished letter is crisp and clearly legible. Static camera with the
faintest handheld drift, very shallow depth of field. Warm neutral palette, soft
natural daylight, calm documentary feel. No sparks. No writing or labels on the
machine. No text in frame other than the four engraved letters themselves.
```

> **Expect to discard takes on this one.** Generate at least three. Reject any
> where the letters are misspelled, malformed, or spell something other than the
> name — that is the single most common failure and it is obvious on a frame.

---

# The Making — 12 shots, 52s

Shots 7, 9 and 12 use Lebon Grace's own product photography and are not
generated. They are listed so the film is complete.

### 1 · `order.mp4` — the order arrives · 4s

```
Overhead shot of an open laptop on a wooden workbench, a pair of adult hands
typing on it. Chisels, a folding rule, a pencil and a paper sketch lie around the
laptop. Fine sawdust on the bench surface. Warm workshop light from one side,
50mm lens, shallow depth of field, static camera. Warm neutral palette, cream and
oat tones, soft natural daylight, calm documentary feel. Nothing readable on the
screen, no logos, no captions, no brand names, no text in frame.
```

### 2 · `sheet.mp4` — the sheet · 4s (5s for The Correction)

```
A woodworker carries a large flat sheet of natural raw MDF across a bright
airy workshop and lays it down onto the flat bed of a cutting machine, pressing it
flat with both hands. The sheet is engineered fibreboard: uniform matte tan, no
wood grain, no planks, no knots. Even overhead lighting, no glare, high windows.
Static wide camera. Warm neutral palette, cream and oat tones, soft natural
daylight, calm documentary feel, a small workshop not a factory. No text in frame,
no logos, no labels.
```

### 3 · `cut.mp4` — see **Priority** above · 5s

### 4 · `name.mp4` — see **Priority** above · 6s

### 5 · `lift.mp4` — lifting it out · 4s

```
A pair of adult hands sorts freshly cut pale MDF pieces laid out on a workbench,
picking one up and turning it over to inspect its edge. The pieces are uniform
matte tan engineered board with no wood grain. Sawdust and offcuts around them,
warm daylight from a high window. 35mm lens, slight handheld movement, documentary
feel. Warm neutral palette, cream and oat tones, shallow depth of field. Not dark
walnut, not glossy. No text in frame, no logos.
```

### 6 · `sand.mp4` — sanding · 5s

```
Close-up of a pair of hands sanding the edge of a small natural raw MDF block with a
folded sheet of sandpaper, in a slow repetitive back-and-forth motion. The block
is uniform matte tan engineered board, grainless. Fine pale dust lifts into a
shaft of light. Shallow depth of field, warm neutral tones, soft natural daylight,
calm documentary feel. No text in frame, no logos.
```

### 7 · assembled — *our product photograph, not generated*

### 8 · `play.mp4` — a child doing the puzzle · 5s

```
A young child's hands place raw MDF puzzle pieces one at a time into a raw MDF
puzzle board on a pale table, other raw MDF pieces arranged around it.
Only the child's hands and forearms are in frame — the face is never visible and
never enters the shot. Soft natural daylight, shallow depth of field, unhurried,
calm documentary feel, warm neutral palette in cream and oat tones. No text in
frame, no logos.
```

> **Keep "hands only, no face".** A generated child has no model-release problem,
> so this is now a craft choice rather than a legal one — but both reference
> films are hands, and a face pulls the shot into stock-photo territory.

### 9 · the plain colour-in version — *our product photograph, not generated*

If you do want to generate it:

```
Overhead shot of a children's raw MDF alphabet jigsaw puzzle in plain white matte
unpainted MDF, uncoloured, lying on cream linen with a neat row of coloured wax
crayons laid out beside it. Dried flowers and a smooth grey stone at the edge of
frame. Soft diffused daylight, no harsh shadows, static overhead camera, very slow
push in. Warm neutral palette. No text in frame, no logos.
```

### 10 · `colour.mp4` — a child colouring · 5s

```
Close-up of a young child's hand filling in a printed line drawing with a coloured
marker pen, coloured pencils and crayons scattered across a warm wooden desk
beside the paper. Only the hand and forearm are in frame — the face is never
visible. Shallow depth of field, soft warm daylight, calm documentary feel, warm
neutral palette. No text in frame, no logos.
```

> **Better if the tool can hold it:** replace "a printed line drawing" with "a
> plain white matte MDF puzzle piece", which is what the shop actually sells.
> Free stock had no such footage. Watch for the board turning glossy or reading
> as paper.

### 11 · `pack.mp4` — packed · 4s

```
A pair of hands folds a plain brown kraft cardboard box closed and smooths a strip
of paper tape across the seam with the thumbs. Warm side light, a workbench
surface, unhurried and careful. 50mm lens, static camera. Warm neutral palette,
cream and oat tones, soft natural daylight, calm documentary feel. No printed text
on the box, no logos, no brand names, no text anywhere in frame.
```

### 12 · the close — *our product photograph, not generated*

---

# The Correction — 12 shots, 61s

Reuses **all eight** clips above. It needs one more, and uses `sheet.mp4` at 5s
rather than 4s.

### `workshop.mp4` — the honest one · 5s

Currently substituted with `sheet.mp4`. The script asks for an empty workshop,
which reads far better under "A machine made this / A machine helped".

```
A wide, quiet shot of a small empty workshop: a flatbed laser cutter at rest with
a sheet of natural raw MDF laid on it, a workbench with cut pieces laid out,
dust drifting in a shaft of daylight from high windows. No people at all. Still
camera, very slow push in. Warm, calm, low contrast, warm neutral palette in cream
and oat tones. No text in frame, no logos, no labels on the machine.
```

To use it: change shot 11 in `src/correction.ts` from `stock/sheet.mp4` to
`stock/workshop.mp4`, add `["workshop", 5]` to `prep-stock.mjs`, re-render.

---

## Shot-to-file map

Both films share one pool. **Generate each file once at its longest listed
duration** — `prep-stock.mjs` already prepares each to the longest demand.

| File | The Making | The Correction | Generate |
|---|---|---|---|
| `order.mp4` | 1 · 4s | 1 · 8s | 8s |
| `sheet.mp4` | 2 · 3.5s | 11 · 8s | 8s |
| `cut.mp4` | 3 · 4.5s | 2 · 3s | 5s |
| `name.mp4` | 4 · 5.5s | 3 · 3s | 6s |
| `inspect.mp4` | — | 4 · 8s | 8s |
| `lift.mp4` | 5 · 3.5s | — | 4s |
| `sand.mp4` | 6 · 4.5s | 5 · 3s | 5s |
| `pack.mp4` | 11 · 4s | 7 · 3s | 4s |
| `play.mp4` | 8 · 4.5s | 8 · 4s | 5s |
| `colour.mp4` | 10 · 4.5s | 10 · 4s | 5s |
| `workshop.mp4` *(optional)* | — | 11 · 8s | 8s |

`inspect.mp4` is a second hands-on-timber shot — use the `lift.mp4` prompt, ask
for 8 seconds, and pick a different take.

---

## Where files go

Save each as `remotion-launch/public/stock/<name>.mp4` using the **exact file
name** from the map, then:

```bash
cd remotion-launch && node prep-stock.mjs
```

That normalises everything to 1920×1080 / 30fps and verifies each output is the
geometry and length the edit assumes. Then re-render:

```bash
cd remotion-launch && npx remotion render src/index.ts MakingMaster out/making-master.mp4
```

If a clip's *content* changes, delete its foley so it regenerates against the new
picture — `rm public/audio/bed/<name>.mp3`, remove that line from
`public/audio/.normalized`, then `node bed.mjs && node normalize.mjs`.

---

## Judge every take before using it

The most expensive mistake on this project was trusting a label. Four stock clips
titled "laser cutting wood" were metal lasers throwing sparks; three doorstep
clips carried Amazon branding. Generated clips fail differently but just as
quietly.

Check every take for:

- **sparks** — the model rendered metal cutting
- **wood grain, planks or knots** — it rendered timber, not MDF
- **garbled or misspelled letters** — the engraving shot's usual failure
- **writing on the machine, or any invented text**
- **a face** appearing partway through a "hands only" shot
- **glossy or dark wood** — must read as light matte board
- **grade drift** — a take much cooler or higher-contrast than the rest

Pull a contact sheet from any clip:

```bash
ffmpeg -i clip.mp4 -vf "select='not(mod(n\,30))',scale=320:-1,tile=5x4" -vsync 0 -frames:v 1 check.jpg
```
