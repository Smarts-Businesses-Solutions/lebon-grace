# remotion-launch — the launch films

Two films, each as a 16:9 master and a 9:16 vertical:

| Film | Length | Source |
|---|---|---|
| The Making | 52s | `src/making.ts` + `src/MakingFilm.tsx` |
| The Correction | 61s | `src/correction.ts` + `src/CorrectionFilm.tsx` |

Scripts, upload kits and the build story live in `../docs/video/`.

---

## First run

```bash
npm install
```

**Then repopulate the product photography**, which is deliberately not tracked —
it is 225MB duplicating `originals/`:

```bash
mkdir -p public/shots
cp ../originals/images/*.png public/shots/
```

The films reference these by exact filename (`shots/abc-jigsaw-board-0.png` and
so on). They are the **unwatermarked** originals; the copies under
`public/images/lasercut/` in the app carry a lebon-grace.com watermark and must
not be used here.

---

## Render

```bash
npx remotion render src/index.ts MakingMaster       out/making-master.mp4
npx remotion render src/index.ts MakingVertical     out/making-vertical.mp4
npx remotion render src/index.ts CorrectionMaster   out/correction-master.mp4
npx remotion render src/index.ts CorrectionVertical out/correction-vertical.mp4
```

Silent copies (audio stripped, picture identical — no re-render):

```bash
ffmpeg -i out/making-master.mp4 -c:v copy -an out/silent/making-master.mp4
```

---

## Verify — always, before shipping

None of these can be replaced by watching once, and two of them caught real
defects that were invisible on a spot check.

```bash
node check-cuts.mjs    # no shot boundary dips to black
node check-audio.mjs   # no silence, dead stretches or clipping
node check-note.mjs    # the end-card note is present and sustained
```

`check-cuts.mjs` exists because the first cut had a **fully black frame at every
clip boundary** — non-overlapping Sequences each fading at their own edges. It
was invisible in a still and obvious in motion.

---

## Regenerating assets

| What | Command | Cost |
|---|---|---|
| Trim + normalise footage to 1920×1080/30fps | `node prep-stock.mjs` | free |
| Narration (OpenAI TTS) | `node voice.mjs` | ~$0.03 |
| Foley + room tone (fal MMAudio) | `node bed.mjs` | ~$0.06 |
| End-card notes (ffmpeg synthesis) | `node note.mjs` | free |
| Loudness targets | `node normalize.mjs` | free |

All are **idempotent** — they skip anything already present. Deleting a file is
what triggers a re-charge.

**If a clip's picture changes, regenerate its foley too**, or the sound will
describe the old shot:

```bash
rm public/audio/bed/<name>.mp3
sed -i '/^bed\/<name>\.mp3$/d' public/audio/.normalized
node bed.mjs && node normalize.mjs
```

---

## The mix

Loudness-normalised so everything plays at volume 1 in Remotion:

| Tier | Target |
|---|---|
| Voice | −16 LUFS |
| Foley | −28 LUFS |
| Room tone | −38 LUFS |
| End-card note | −30 (Making) / −23 (Correction) |

Set by measurement, not by ear — this mix was built by people who could not hear
it. The raw generated beds ranged from −10 to −35 LUFS; unnormalised, the
cutting shot would have been ~25 dB louder than the child playing.

The Correction's note is louder because its close is narrated end to end and a
−30 pad was simply masked.

---

## Generating new shots

- `generate-shots.mjs` — fal.ai LTX-2.3 Fast, 1080p. **$0.06/s, confirmed
  against a real charge** (the model page's own $0.04/s table is stale).
- `ltx-local.mjs` — local ComfyUI + LTX-Video 2B. Free, but see below.

**LTX-Video 2B cannot do the hero shots.** Measured: it renders planked pine
when asked for grainless MDF, cannot hold macro, and produced no smoke. Raising
resolution and steps 7× changed nothing. It is fine for ordinary human action
(`order`, `play`, `pack`) and useless for material fidelity.

Prompts for every shot: `../docs/video/PROMPTS-playground.md`. Always judge a
take on extracted frames — four stock clips titled "laser cutting wood" were
metal lasers throwing sparks, and two of three engraving takes spelled the name
as gibberish.

---

## Not tracked, and why

| Path | Why |
|---|---|
| `out/`, `node_modules/` | regenerable |
| `old/` | ~755MB of superseded cuts |
| `public/shots/` | 225MB duplicating `originals/` |
| `../.ltx-takes/` | generated takes; the two used are prepped into `public/stock/` |

`public/stock/` **is** tracked — the prepped clips are the only surviving copy
of the films' footage.
