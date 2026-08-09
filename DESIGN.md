# Lebon Grace — Design

**Last Updated:** 2026-08-09

The visual and interaction rules, and — more usefully — the things we decided
**not** to do and why.

---

## The feeling we're after

A workshop, not a warehouse. Everything is made one at a time by hand, and the
shop should read that way: warm paper tones, generous space, photographs of the
actual object rather than renders. The nearest reference is an editorial spread
about a maker, not a marketplace grid.

## Tokens

Colour, type and spacing live as CSS custom properties in
`src/app/globals.css` and flow into Tailwind 4. **Change them there, never
inline** — the contrast audit reads the declared pairs, so a hardcoded hex is
invisible to it.

```
--color-ink          body text
--color-ink-muted    secondary text   (#6f685e — see below)
--color-sand         warm background
```

`--color-ink-muted` was darkened from `#7d766c` to `#6f685e` to clear the WCAG AA
floor. Watch it: darkening a token to fix one surface pushed a *dark* panel on
`/about` from 3.61:1 down to 2.94:1. Tokens are global; check both themes.

## Accessibility — a floor, not a feature

- **4.5:1** for normal text, **3:1** for large (≥24px, or ≥18.66px bold)
- **44×44** minimum tap target (WCAG 2.5.5). The cart quantity controls were
  27×32 — fine with a mouse, a coin-flip with a thumb, on the control between a
  customer and changing what they are about to buy.
- Base styles must sit in a `@layer`, or utilities cannot override them.
- Headings need explicit colour on dark sections — they were invisible on every
  dark band until someone looked.

Verified two ways, because they catch different things:

```bash
npm run audit:contrast    # arithmetic over declared token pairs
npx playwright test tests/e2e/a11y   # axe-core over the rendered DOM
```

The axe pass found 51 nodes the arithmetic could not, because it sees what
actually rendered.

## Layout and responsive

Mobile first — most customers arrive on a phone. Three tested viewports: mobile
375, tablet 768, desktop 1280.

**The one geometric rule that keeps breaking:** the WhatsApp float and the
product page's sticky buy bar occupy the same corner. The float was `z-50
bottom-6` against the bar's `z-40 bottom-0`, so on every product page the green
circle sat on *Add to cart* and ate the tap. The mobile suite now asserts they do
not overlap **geometrically**, so a restyle cannot quietly reintroduce it.

## Photography

The product photograph is the product. It gets the space. An earlier layout put
a sidebar next to it that repeated the same information — that sidebar is gone
and the image is larger. Dimensions are read off the third photograph of each
piece rather than guessed.

## Things we decided not to do

- **No carousels.** They hide the second item from everyone and the first from
  screen readers.
- **No emoji as UI.** They render differently on every platform and read as
  noise next to hand-made objects. The last ones were removed deliberately.
- **No "X people have this in their cart" urgency.** It would be a lie at this
  volume.
- **No dark mode toggle.** Two themes to maintain, on a shop whose whole palette
  is warm paper. Dark *sections* exist; a dark *mode* does not.
- **No skeleton loaders on the catalogue.** It renders server-side; there is
  nothing to wait for.

## If you change a colour

1. Change the token in `globals.css`, not the component.
2. `npm run audit:contrast` — declared pairs.
3. `npx playwright test tests/e2e/a11y` — rendered DOM, both light and dark bands.
4. Look at `/about`. It has the dark panel that the last token change broke.
