# Veo run sheet — the two shots free stock could not provide

Copy-paste ready. Two prompts, exact settings, and what to reject.

---

## Read this first — it decides whether the output is usable

**1. Use the API, not the Gemini app or AI Studio.**
The visible Veo badge is stamped on the free and mid tiers. The `generateContent`
API does not stamp it. This is the whole reason to run it here rather than where
the last clips came from. (SynthID, the invisible watermark, stays either way —
that is fine and does not affect commercial use.)

**2. Veo 3.1 has no `negativePrompt` parameter.**
Confirmed against the API reference: the only knobs are `aspectRatio`,
`resolution`, `durationSeconds` and `personGeneration`. Every constraint
therefore has to live *inside the prompt text*. The prompts below are written
that way — do not trim them, the long tail of "no…" clauses is doing real work.

**3. Generate no text.**
The last run rendered `Fraunces, ink #23201c` into frame one and put
**"Lebanon Grace"** — the wrong brand name — on the end card. That happened
because the prompt came from `SCRIPT-A`, which contains the typography spec and
the `On screen:` blocks. Everything below is stripped of both. All captions,
the strikethrough and the wordmark are added afterwards in Remotion, in real
Fraunces, correctly timed.

---

## Settings — identical for both shots

| Parameter | Value |
|---|---|
| model | `veo-3.1-lite-generate-preview` (cheapest at 1080p) |
| aspectRatio | `16:9` |
| resolution | `1080p` |
| durationSeconds | `6` |
| personGeneration | `allow_adult` |

**Model choice.** Lite is $0.08/s at 1080p, Fast $0.12/s, Standard $0.40/s. At
6 seconds that is $0.48 / $0.72 / $2.40 per take. Start on Lite; only move up if
Lite cannot hold the macro. Three takes each on Lite ≈ **$2.88 total**.

**Why 6 seconds.** The edit needs 4.5s for `cut` and 5.5s for `name`. Six is the
next allowed value and leaves margin for `prep-stock.mjs` to take a centred cut.

---

# Shot 1 — `cut.mp4` · the laser cutting

Paste exactly this as the prompt:

```
Extreme macro shot of a laser cutter head slowly tracing a smooth curved outline through a flat sheet of natural raw MDF. The board is engineered fibreboard: a completely uniform, matte, grainless tan surface, with no wood grain, no planks, no knots and no varnish. A thin ribbon of pale grey smoke rises steadily from the cut line and drifts slowly to the left. A small soft amber glow at the single point of contact. The scorched dark edge of the cut is visible in the board. The dark machine gantry sits above, out of focus. Slow lateral tracking shot, extremely shallow depth of field, the cut line sharp and everything else soft. A small quiet workshop, not a factory floor. Warm neutral palette, cream and oat tones, soft natural daylight, low contrast, calm documentary feel. Cutting MDF produces smoke and never sparks, so there are no sparks, no molten metal and no welding anywhere in the shot. There is no text, no lettering, no numbers, no captions, no subtitles, no logos, no brand names and no labels of any kind anywhere in the frame, including on the machine.
```

---

# Shot 2 — `name.mp4` · the name being engraved

Paste exactly this as the prompt:

```
Extreme macro of a laser engraving the short name LUCY into natural raw MDF, the four capital letters appearing one at a time from left to right in a simple clean serif. The board is engineered fibreboard: a completely uniform, matte, grainless tan surface, with no wood grain, no planks and no knots. Faint pale smoke curls upward from each stroke as it burns. A small soft amber glow at the point of contact. The darkened scorched edge of each finished letter is crisp and clearly legible, correctly spelled. Static camera with the faintest handheld drift, very shallow depth of field. Warm neutral palette, cream and oat tones, soft natural daylight, low contrast, calm documentary feel. There are no sparks. The only text anywhere in the frame is the four engraved letters spelling LUCY: no captions, no subtitles, no logos, no brand names, no watermarks and no labels on the machine.
```

> **Budget the most takes here.** On the last run only one take in three produced
> real letters; the other two rendered convincing-looking gibberish. It is the
> single most likely thing to fail and it is obvious on a single frame.

---

## Running it

Install once:

```bash
pip install google-genai
```

Then set your key (get one at aistudio.google.com, then keep it with the others
in `supabase.local` as `GEMINI_API_KEY=`):

```bash
export GEMINI_API_KEY="your-key-here"
```

Minimal call — change `prompt` and `output` for each shot:

```python
import time
from google import genai
from google.genai import types

client = genai.Client()

operation = client.models.generate_videos(
    model="veo-3.1-lite-generate-preview",
    prompt="<paste one of the prompts above>",
    config=types.GenerateVideosConfig(
        aspect_ratio="16:9",
        resolution="1080p",
        duration_seconds="6",
        person_generation="allow_adult",
    ),
)

while not operation.done:
    print("generating…")
    time.sleep(10)
    operation = client.operations.get(operation)

video = operation.response.generated_videos[0]
client.files.download(file=video.video)
video.video.save("cut-veo-t1.mp4")
```

Run it three times per shot, saving `cut-veo-t1/t2/t3.mp4` and
`name-veo-t1/t2/t3.mp4`.

---

## Reject a take if you see any of this

Check a few frames before keeping anything — a bad take is obvious on one frame
and invisible in a filename.

- **sparks** — the model rendered metal cutting instead of wood
- **wood grain, planks or knots** — it rendered timber, not MDF
- **misspelled or malformed letters** — `name.mp4` must read LUCY, nothing else
- **any text, logo or label** that is not the engraved letters
- **a visible watermark** — means it came from the app tier, not the API
- **glossy or dark wood** — must read as light matte board
- **wide framing** — both shots are macro; a mid-shot is a failed take

Pull a contact sheet from any clip:

```bash
ffmpeg -i cut-veo-t1.mp4 -vf "select='not(mod(n\,15))',scale=320:-1,tile=5x3" -vsync 0 -frames:v 1 check.jpg
```

---

## When you have the files

Drop the two you pick into `remotion-launch/public/stock/` as exactly
`cut.mp4` and `name.mp4`, then:

```bash
cd remotion-launch && node prep-stock.mjs
```

Hand them to me instead if you prefer — I will verify the frames, regenerate the
foley for both shots against the new picture, re-render all four outputs and
re-run the cut, audio and note checks.

Nothing else in either film changes. These are two shots out of twelve.
