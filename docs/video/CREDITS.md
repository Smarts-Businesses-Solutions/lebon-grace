# Credits and licences — the launch films

Covers both films, which share one pool of footage:

| Film | Master | Vertical | Length |
|---|---|---|---|
| The Making | `out/making-master.mp4` | `out/making-vertical.mp4` | 52s |
| The Correction | `out/correction-master.mp4` | `out/correction-vertical.mp4` | 61s |

Everything in them is either Lebon Grace's own product photography or free
stock cleared for commercial use.

**Audio is generated, not licensed** — the narration with OpenAI
`gpt-4o-mini-tts` and the foley with fal.ai `mmaudio-v2`, both from prompts
written for this project. Nothing was sampled or sourced from a library, so no
third-party audio rights apply. Details in [VOICEOVER.md](VOICEOVER.md).

Neither Pexels nor Pixabay requires attribution. This file exists anyway,
because the question a credits file answers is not "must we credit?" but
"where did this frame come from, and were we allowed to use it?" — and that
question tends to get asked long after everyone has forgotten.

---

## Stock footage

All eight clips are from Pexels, under the [Pexels
License](https://www.pexels.com/license/): free for commercial use, no
attribution required, no permission needed. Both films draw on the same eight.

| Beat | File | Source | Author | Page |
|---|---|---|---|---|
| the order arrives | `order.mp4` | Pexels | Pavel Danilyuk | https://www.pexels.com/video/a-person-using-a-laptop-in-a-workshop-4480553/ |
| the sheet | `sheet.mp4` | Pexels | cottonbro studio | https://www.pexels.com/video/a-man-carrying-a-plywood-while-putting-on-the-table-7479049/ |
| the machine cuts | `cut.mp4` | Pexels | Sururi Ballıdağ Director | https://www.pexels.com/video/working-with-wood-13691887/ |
| lifting it out | `lift.mp4` | Pexels | Los Muertos Crew | https://www.pexels.com/video/a-woodworker-working-8447762/ |
| sanding | `sand.mp4` | Pexels | Ono Kosuki | https://www.pexels.com/video/a-person-sanding-the-edge-of-a-wood-5972655/ |
| packed | `pack.mp4` | Pexels | SHVETS production | https://www.pexels.com/video/putting-tape-on-a-box-7205517/ |
| a child doing the puzzle | `play.mp4` | Pexels | kaboompics.com | https://www.pexels.com/video/child-solving-a-triangular-shaped-puzzle-7312135/ |
| a child colouring | `colour.mp4` | Pexels | Kindel Media | https://www.pexels.com/video/kid-coloring-a-drawing-of-rocket-ship-7106516/ |

Each was trimmed to a centred segment, cropped to 1920×1080 and re-graded by
`remotion-launch/prep-stock.mjs`. Sources are unmodified originals; nothing was
re-uploaded anywhere.

### The two clips with children in them

Both were chosen as **hands-on-the-work shots with no identifiable face**, and
that was a licence decision as much as an aesthetic one. Neither Pexels nor
Pixabay guarantees a model release, and Pixabay says outright that the user is
responsible for checking whether further consent is needed. A commercial advert
built around an identifiable child is the worst possible place to discover that
gap, so the film does not contain one.

If either clip is ever replaced, keep that constraint.

## Lebon Grace's own photography

From `remotion-launch/public/shots/` — no licence question, they are ours.

| Beat | File |
|---|---|
| the engraving (macro) | `shots/abc-jigsaw-board-0.png` |
| assembled | `shots/alphabet-learning-board-0.png` |
| the plain colour-in version | `shots/abc-jigsaw-board-1.png` |
| the close | `shots/abc-jigsaw-board-0.png` |

Every product has three photographs and the suffix matters: `-0` is the natural
MDF piece on linen, `-1` is the white colour-in version styled with crayons,
and `-2` is that same white version **with a dimension label burnt into the
pixels** ("196mm x 149mm"). Only `-0` and `-1` are usable on screen.

---

## What the licences actually restrict

Both licences permit commercial use with no attribution, and both then
constrain *how*. The three that bear on this film:

1. **No deceptive use.** Pixabay bars using content "in a misleading or
   deceptive way"; Pexels bars implying endorsement. This is why every caption
   states a fact about the *product* — price, lead time, engraving, age range,
   where it is made — and never a claim about the room on screen. The workshops
   are not Lebon Grace's workshop and neither film says they are.

   It is also why the two colouring beats carry **no caption at all**. Every
   product's photo set includes a white colour-in version, so it is already
   visible on the listing — but no copy anywhere on the site describes it,
   names it, or says whether crayons are included. Captioning it would put a
   claim in the film that the shop does not make. Add the caption once the site
   says it.
2. **No recognisable trademarks.** Three otherwise-usable doorstep clips were
   rejected for visible Amazon branding.
3. **No identifiable person shown badly.** One doorstep clip was rejected on
   this ground.

## Clips rejected, and why

Recorded because the rejections are the reason the edit looks the way it does,
and because someone will otherwise re-search the same terms and download the
same wrong clips.

| Clip | Why rejected |
|---|---|
| Pexels 30455960, 30455962, 15780166, 34240702 | Titled "laser cutting wood"; all four are industrial **metal** fibre lasers throwing sparks. Laser-cutting MDF makes smoke, not sparks. |
| Pexels 38579523 | Titled "laser cutter plywood"; the page slug says metal cutting. |
| Pexels 30456097 | "CNC laser cutting" — metal. |
| Pexels 7362618, 6994416 | Doorstep parcels with visible **Amazon** branding. |
| Pexels 8926524 | Doorstep clip framing a person unflatteringly. |
| Pexels 7362609 | Doorstep clip built around a branded delivery box. |

## The shot that does not exist

Script B's shots 3 and 4 — a laser tracing a curve through MDF with smoke
lifting, and a child's name appearing letter by letter — are the shots the
script calls "the film". **Neither exists in free stock.**

104 unique candidates were searched across both libraries for those two slots.
Everything returned was industrial metal fabrication, laser light shows, or —
for "wood burning letters" — bonfires.

So shot 3 uses a router cutting real wood in a real workshop, and shot 4 uses a
macro of letters a laser genuinely did cut, on our own product. The film never
claims to show our laser, because no honest footage of it exists yet.

**Thirty seconds of phone footage of the actual laser cutting one actual name
would replace both shots and beat everything here.** If that gets filmed, this
script becomes the shot list for it.
