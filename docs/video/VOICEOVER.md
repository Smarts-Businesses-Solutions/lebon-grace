# Sound and voiceover — both films

> **BUILT.** All four outputs now carry audio. Verified continuous, no
> clipping, no dead stretches — `remotion-launch/check-audio.mjs`.
>
> | File | Length | Integrated | True peak |
> |---|---|---|---|
> | `making-master.mp4` / `-vertical` | 52.1s | −18.3 LUFS | −3.5 dBTP |
> | `correction-master.mp4` / `-vertical` | 61.1s | −18.7 LUFS | −3.3 dBTP |
>
> **Total spend: about $0.09** — $0.03 voice, $0.06 sound bed.

---

## Why they were silent

Three separate causes, not one:

1. **The Pexels source clips carry no audio stream at all.** Video only. There
   was never any sound to keep.
2. **The compositions had no `<Audio>` track.** Nothing was ever mixed in.
3. **Both scripts specified silence.** Script A: *"No voice-over. The type is
   the voice."* Script B: *"The absence of music is the point."*

The third is worth remembering: adding a voice is a **change of direction**, not
a bug fix. Both reference films persuade by showing work and letting you
conclude, and a voice explaining what you can already see is the fastest way to
turn a quiet film into an advert. It was added deliberately, on request.

---

## The mix

Three tiers, each loudness-normalised to a fixed target by `normalize.mjs`, so
everything plays at volume 1 in Remotion:

| Tier | Target | What it is |
|---|---|---|
| Voice | −16 LUFS | narration, per line, at exact frames |
| Foley | −28 LUFS | per shot, only over stock footage |
| Room tone | −38 LUFS | looped under everything, always |

**Why normalise instead of setting volumes by ear:** nobody who built this mix
could hear it. `volume={0.3}` would have been a guess, and a buried voice or
deafening foley is not discoverable without ears. Normalising to measured
targets makes the balance correct by construction and checkable afterwards.

It also turned out to be necessary rather than fastidious — the raw generated
beds ranged from **−10.1 LUFS** (`cut`) to **−34.7** (`play`). Mixed unmodified,
the cutting shot would have been roughly 25 dB louder than the child playing.

**Room tone exists so the film never goes to digital silence.** The product
plates have no foley of their own; without a bed under them, a hard cut to
nothing reads as a broken file rather than as quiet.

---

## The Making — voiceover

52s, 8 lines. Roughly half the film has no voice at all: the cutting and
sanding shots are the ones people watch.

| Frame | In | Line |
|---|---|---|
| 30 | 0:01 | Nothing here is sitting in a warehouse. |
| 240 | 0:08 | It starts as one sheet of MDF, and a laser. |
| 390 | 0:13 | The letters are cut, not printed. |
| 540 | 0:18 | Then every piece is checked by hand. |
| 800 | 0:27 | The same price for everything in the shop. |
| 900 | 0:30 | Made for one child, not for a shelf. |
| 1290 | 0:43 | Packed by hand. |
| 1470 | 0:49 | Lebon Grace. |

**The voice never restates a caption.** That is the failure mode with narration
over typography — the viewer processes the same sentence twice and the film
feels padded. So the engraving shot (`Engraving · free`) and the sanding shot
(`Sanded by hand`) have no line over them: the type already carries the point,
and the voice would only repeat it.

**0:34–0:43 is silent.** Those are the plain white version and a child
colouring it in. No copy on the site describes that version, so there is
nothing true to say over it — the captions are blank for the same reason.

---

## The Correction — voiceover

61s, 10 lines. The speaker states something, hears it, and corrects themselves.

| Frame | In | Line |
|---|---|---|
| 10 | 0:00 | This puzzle is in stock. |
| 132 | 0:04 | *It isn't. It doesn't exist yet.* |
| 430 | 0:14 | We ship it the same day. |
| 552 | 0:18 | *We start cutting it.* |
| 760 | 0:25 | The engraving costs extra. |
| 882 | 0:29 | *It doesn't. It never has.* |
| 1420 | 0:47 | A machine made this. |
| 1542 | 0:51 | *A machine helped.* |
| 1660 | 0:55 | Nothing is made until you ask for it. |
| 1755 | 0:58 | Lebon Grace. |

### The film got 12 seconds longer, and the voice is why

Silent, the strike device works in 150 frames: the line appears, a rule crosses
it at frame 42, the replacement rises at 66. **Spoken, it does not.** The
unhurried read of "A machine made this" runs 2.9s — so the replacement line
appeared, and was spoken, while the struck line was still being said. Two
voices at once.

Nine of the first eighteen generated lines overran their slot. The fix was to
give the device room rather than rush the voice:

- statement shots **150 → 240 frames** (5s → 8s)
- the rule now crosses at frame **100**, after the first line has been fully
  spoken, in the silence before the correction
- the replacement rises at **127**, just before the voice says it at 132
- film length **49s → 61s**

That pause is the whole performance. It is what makes it read as somebody
catching themselves rather than being interrupted.

One knock-on: the "same day" shot needed a source longer than 8s and `lift.mp4`
is only 7.0s, so it now uses `inspect.mp4`. A Sequence longer than its video
does not error — it holds the last frame, which is a freeze nobody notices
until it ships.

**If the voice is ever removed, put the device back to 42/66** — see
`STRIKE_RULE` in `CorrectionFilm.tsx`.

---

## How it was made

| Layer | Tool | Notes |
|---|---|---|
| Voice | OpenAI `gpt-4o-mini-tts`, voice `shimmer` | Chosen for its `instructions` field: "unhurried" is a direction, not a voice |
| Foley | fal.ai `mmaudio-v2` | Video-to-audio: it watches the actual clip, so the sanding rhythm lands on the actual sanding |
| Levels | ffmpeg two-pass `loudnorm` | One-pass drifts badly on files this short |

**One file per line, one bed per source clip.** Lines are separate files so each
lands on an exact frame and cannot drift; a single take would have to be cut by
ear and re-cut whenever a shot length changed. Beds are per source clip, not per
shot, because both films share one pool.

### Regenerating

```bash
cd remotion-launch
node voice.mjs      # narration; skips anything already generated
node bed.mjs        # foley + room tone
node normalize.mjs  # loudness targets; idempotent, marker file
```

`src/vo.ts` is the single source of truth for line text and frames — `voice.mjs`
reads it to generate and to check each line fits before the next begins, and the
films read it to place the audio. Keeping frames in two places would let a
re-timed line move the picture and not the voice.

### Verifying

```bash
node check-audio.mjs   # silence, dead stretches, clipping, loudness
node check-cuts.mjs    # picture: no boundary dips to black
```

---

## What is still worth doing

- **A real voice.** A synthetic read is good enough to ship and wrong for a
  hand-made product. The owner reading these lines — a real UAE voice, slightly
  imperfect — would beat it outright, and the tables above are the script to
  read against. Swap the files in `public/audio/vo/`, keep the names, re-run
  `normalize.mjs`.
- **One sustained warm note under each end card.** Both scripts call for it and
  neither film has it. Nothing else should have music.
- **Two lines sit slightly under target** after normalising (`making-m08` at
  −19.0, `correction-c03b` at −17.8, against −16). Short files defeat linear
  loudnorm. Audible as a slightly quieter "Lebon Grace" at the close; fixable by
  regenerating those two with a longer read.
