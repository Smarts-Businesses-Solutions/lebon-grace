# How this was actually built — the reference

**This is the source document.** Every "building in public" post, caption,
thread and future video should be written from here rather than reinvented, so
the story stays consistent and stays true.

Written from Evariste's own account of the process, 14 August 2026.

---

## The one-sentence version

> The website looks like something you could one-shot with AI. It wasn't. The
> hardest part was the images, and the images were only possible because a human
> drew the puzzles first — in real vector software, to real laser dimensions.

---

## The thing most people get wrong

Looking at shop.lebon-grace.com, the natural assumption is: *prompt an agent,
get a shop.* That assumption is wrong in a specific and interesting way, and the
specifics are the story.

**The code was the easy part. The pictures were the hard part.**

That is the opposite of what most people expect, and it is the hook for almost
every post in the build-in-public kit.

---

## Where AI genuinely struggled

**Geometry and pattern.** Interlocking puzzle shapes are hard for image models
in a way that a photograph of a room is not. Every tab has to match a
corresponding blank. Every piece has to tile with its neighbours. Get one edge
wrong and the whole board is wrong.

**What came back was often unusable:** malformed drawings, shapes rendered
weirdly, pieces that could not physically interlock. Not a few bad takes — a
lot of them.

**This session is a live example of the same limitation.** Generating two shots
for the launch film:

- open-weight LTX-Video 2B rendered planked pine with knots when asked for
  grainless MDF, and could not do macro at all
- of three takes at engraving the name "LUCY", **two produced convincing-looking
  gibberish** — the letters looked right at a glance and were nonsense
- the word "wooden" in a prompt silently overrode three explicit instructions
  not to render wood grain

Text and geometry are the same class of failure: things with *rules*, where
"looks about right" is not right.

---

## The frontier-model observation

**Frontier models — Claude, GPT — have a real edge here over open-weight
models, and that edge is what justifies the price tag.** They get materially
closer to what the builder actually had in mind. Not all the way. Closer.

This is also visible in this project's own logs: the paid 22B model produced a
usable laser shot; the free 2B model on the same prompt produced planked pine.
Same prompt, same machine, different class of model.

That is a defensible, specific claim, and it is more interesting than "AI good"
or "AI slop".

---

## The actual workflow

```
1. HUMAN   draw the puzzle in vector software, to real laser-bed dimensions
2. AI      generate the product image from that drawing, with instructions
3. AI      build the website, the shop, the checkout, the admin
4. HUMAN   cut the piece on the laser
5. HUMAN   assemble it, check every piece actually fits
6. HUMAN   sand it, pack it, post it
```

**Step 1 is the one nobody sees, and it is the one that makes the rest
possible.** The image model is not inventing a puzzle. It is rendering a puzzle
that already exists as a file.

---

## Why the drawing must be real CAD, not a picture

This is the strongest point in the whole story and it should lead more than one
post.

**A laser cuts exactly what is in the file.** Not approximately. Exactly.

So the drawing cannot be a plausible-looking image of a puzzle — it has to be a
true vector path, drawn to the laser bed's real dimensions, with the piece sizes
those dimensions allow. If the geometry is fictional, the cut is fictional: the
pieces come out and **they do not fit**.

An AI-generated *picture* of a puzzle is a picture. An AI-generated *cut file*
that has not been verified is a box of pieces that do not interlock, discovered
after the material is spent.

That is the difference between a render and a product, and it is why a human
sits in the loop at exactly that point.

---

## What is still entirely manual

None of this is visible on the website, and all of it is the actual business:

- cutting each piece on the laser
- assembling the puzzle
- **checking every piece genuinely fits** — the step that catches a bad drawing
- sanding by hand
- packing
- posting

The site says *"made to order"* and *"sanded by hand"*. Both are literally true,
and this is what they mean.

---

## How much of it was AI

Evariste asked for a percentage. A single number would be misleading, so here is
the split — adjust to taste, but keep the shape:

| Part of the build | AI share | Notes |
|---|---|---|
| Website, shop, checkout, admin | **~85–90%** | AI-drafted, human-directed and human-reviewed throughout |
| Product images | **~50%** | AI rendered them — from drawings that were 100% human |
| Puzzle drawings / cut files | **0%** | Human, in vector software, to real laser dimensions |
| Cutting, assembly, fit-checking | **0%** | Human |
| Sanding, packing, posting | **0%** | Human |

**The honest headline: *AI did most of the building, and none of the product.***

Or, if one number is wanted: **"about half AI-assisted overall — and zero percent
of anything a customer actually holds."**

Avoid "100% AI" or "built with AI in a weekend". Both are false here and both
invite the exact scepticism the story is designed to disarm.

---

## Where this goes next

The near-future version of this workflow is real and worth saying out loud:
one day an agent will draw the vector itself, to the correct laser dimensions,
generate the image from its own drawing, build the page and publish it.

**It cannot do that reliably today.** That gap — between what looks automatable
and what is actually automatable — is the whole subject.

---

## To confirm before publishing

- [ ] **The drawing software.** Written as "vector drawing software" throughout;
      Inkscape is assumed from the dictation. Name it explicitly if correct.
- [ ] **The percentages** in the table — mine are estimates from the build, and
      the number is yours to set.
- [ ] **Laser bed dimensions** — worth stating concretely in a post if you are
      comfortable ("our bed is X × Y, which is why pieces are capped at…").
- [ ] Whether to name Claude and GPT explicitly, or say "frontier models".

---

## Things NOT to say

- **Do not claim the launch films' workshop footage is yours.** Most of it is
  licensed stock of someone else's workshop and two shots are AI-generated. The
  captions deliberately only describe the product.
- **Do not imply the site was one-shot.** That is the myth the story exists to
  correct.
- **Do not cite the 755-DXF design catalogue** from 1 July as current. It belongs
  to a superseded phase and those files are not in the shop today. The live
  catalogue is 42 products at AED 15.
