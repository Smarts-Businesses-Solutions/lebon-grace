# Ten-second prompts — one continuous take per film

Two prompts. Each is a **single unbroken shot**, not a compressed film.

---

## Why they are written this way

The last 10-second attempt crammed a 38-second script into 10 seconds: four
corrections and an end card landed in the final 3.5s, which is why the captions
read as too fast. Ten seconds cannot hold twelve shots — trying is what broke
it.

So each prompt below is **one camera move with a beginning and an end**. That is
what these models actually do well at this length, and it gives each film a
single idea rather than a summary of twelve.

**Neither prompt generates text.** All captions, the strikethrough and the
wordmark are added afterwards in Remotion, in real Fraunces, at whatever pace
you like. The last run rendered `Fraunces, ink #23201c` into frame one and put
**"Lebanon Grace"** on the end card — both because the prompt came from the
script docs, which carry the typography spec and the `On screen:` blocks.

---

## Duration support — check before you pick a tool

| Tool | Durations | 10s? |
|---|---|---|
| **Veo 3.1 API** | 4, 6, 8 | **No — 8s max** |
| LTX-2.3 (fal) | 6, 8, 10, 12 … 20 | Yes |
| MiniMax H3 | 5–15 | Yes |
| Kling | 5, 10 | Yes |

**Veo caps at 8 seconds via the API** — and Veo is the model that actually
rendered the laser convincingly. Both prompts below work unchanged at 8s; the
move is slow either way and the model paces to the duration. If you want the
best result, take 8s on Veo rather than 10s somewhere weaker.

Settings otherwise: `16:9`, `1080p`.

---

# THE MAKING — 10s (or 8s)

**One take: the thing being made, then held.** Cut, then lift — the whole
promise of made-to-order in one move.

```
A single continuous extreme macro shot in a small quiet workshop. It opens on a laser cutter head slowly tracing a smooth curved outline through a flat sheet of natural raw MDF, a thin ribbon of pale grey smoke rising steadily from the cut line, a small soft amber glow at the point of contact, the scorched dark edge of the cut visible in the board. The camera drifts slowly to the right as the cut completes. Two adult hands then enter the frame, lift the freshly cut raw MDF piece out of the sheet and turn it over to inspect the edge, fine sawdust falling. The board is engineered fibreboard: a completely uniform, matte, grainless tan surface with no wood grain, no planks, no knots and no varnish. Warm neutral palette, cream and oat tones, soft natural daylight from a high window, low contrast, very shallow depth of field, unhurried documentary feel. Cutting MDF produces smoke and never sparks, so there are no sparks, no molten metal and no welding anywhere in the shot. There is no text, no lettering, no numbers, no captions, no logos, no brand names and no labels of any kind anywhere in the frame, including on the machine.
```

---

# THE CORRECTION — 10s (or 8s)

**One take: nothing, then something.** This is the film's argument made visual —
*it does not exist yet*, and then it does. The strikethrough lines go on top in
Remotion.

```
A single continuous extreme macro shot in a small quiet workshop. It opens held on a completely blank, untouched sheet of natural raw MDF filling the frame, still and empty, nothing happening. A laser cutter head then descends into the top of the frame and begins to burn the letters of the name LUCY into the board, the four capital letters appearing one at a time from left to right in a simple clean serif, faint pale smoke curling upward from each stroke, a small soft amber glow at the point of contact, the darkened scorched edge of each finished letter crisp and clearly legible. The camera pulls back very slowly to reveal the finished engraved board resting on a workbench. The board is engineered fibreboard: a completely uniform, matte, grainless tan surface with no wood grain, no planks and no knots. Warm neutral palette, cream and oat tones, soft natural daylight, low contrast, very shallow depth of field, calm and unhurried. There are no sparks. The only text anywhere in the frame is the four engraved letters spelling LUCY: no captions, no subtitles, no logos, no brand names, no watermarks and no labels on the machine.
```

---

# THE CHILD — 10s (or 8s) · pairs with either film

**One take: the finished thing, being used.** Both 52s/61s cuts already carry a
child playing and a child colouring, but the two hero prompts above are workshop
only — they show the object made and never used, which was the exact flaw in the
first cut of The Making.

Generate this as a **second 10-second clip** and you have a two-shot, 20-second
film: *made*, then *used*. That arc is the whole product.

```
A single continuous shot in a bright, plainly furnished room. It opens close on a finished natural raw MDF alphabet puzzle board resting on a pale table, the engraved letters clearly visible. A young child's hands enter the frame, pick up a loose letter piece, turn it, and press it into its slot in the board, then reach for another. The camera pulls back very slowly. The board is engineered fibreboard: a uniform, matte, grainless tan surface with no wood grain, no planks and no knots. Warm neutral palette, cream and oat tones, soft natural daylight from a window out of frame, low contrast, shallow depth of field, unhurried and calm, documentary and unposed. Indoors throughout, with no garden, no greenery and no bright saturated colours. There is no text, no lettering, no captions, no logos, no brand names and no watermarks anywhere in the frame.
```

### Two framing choices

The prompt above is **hands and forearms only, no face** — matching the current
films, where that framing was chosen because neither stock library guarantees a
model release.

**A generated child has no release problem**, so a face is now available to you
if you want one. To use it, replace *"A young child's hands enter the frame"*
with:

> A young child sits at the table, absorbed, and reaches in to press a letter
> piece into its slot, glancing down at the board and not at the camera.

Warmer, and it changes the register — hands read as craft, a face reads as a
toy advert. Both defensible; the current films are hands.

### If you want the child inside one take

You can end the workshop prompts on the child instead of generating separately —
append this to either hero prompt:

> The camera then pulls back further as a young child's hands reach into the
> frame and lift the finished piece from the bench.

Less reliable: a single generation asked for two locations tends to drift. The
separate clip is the safer build, and gives you a standalone 10s post as well.

---

## Where the captions go

Both films already time their type properly in Remotion, and that is where the
pacing problem is solved:

- statement shots run **240 frames — 8 seconds**
- the line appears at frame 8, is spoken at 10
- the rule crosses at frame 100, *after* the line has been read
- the correction rises at 127 and is spoken at 132

That is deliberately slow. I lengthened those shots from 150 frames precisely
because the corrections were landing too fast once there was a voice.

So a 10-second generated clip is **footage**. Drop it in, and the type sits on
top at whatever pace reads best.

---

## Reject a take if you see

- **sparks** — it rendered metal cutting
- **wood grain, planks or knots** — timber, not MDF
- **misspelled letters** — must read LUCY and nothing else
- **any text or logo** that is not the engraved letters
- **a visible watermark** — came from an app tier, not the API
- **wide framing** — both are macro; a mid-shot is a failed take

```bash
ffmpeg -i take.mp4 -vf "select='not(mod(n\,15))',scale=320:-1,tile=5x4" -vsync 0 -frames:v 1 check.jpg
```

---

## Honest note

A single 10-second take cannot replace either film — it replaces the *hero
shot* of each. The 52s and 61s cuts stay as they are; these give each one a
stronger centre, and double as standalone clips for Instagram or X where ten
seconds is the whole format.

If you want a true 10-second film rather than a 10-second shot, that is a
different job: three or four 3-second beats cut together, with the type carrying
the argument. Say the word and I will write that instead.
