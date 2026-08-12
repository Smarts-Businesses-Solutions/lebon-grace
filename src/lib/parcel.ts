/**
 * How big and how heavy is the box — the physical data every carrier demands.
 *
 * Emirates Post's `CreateBooking` requires `Pieces, Weight, WeightUnit, Length,
 * Width, Height, DimensionUnit`. DHL, Shippo and EasyPost all want the same
 * thing under different names. The shop held none of it, which is why no
 * carrier could be asked for a rate and international shipping stayed
 * quote-on-request.
 *
 * WHY PRESETS AND NOT PER-PRODUCT MEASUREMENTS. Measuring hundreds of products
 * is the kind of task that never finishes. It also turned out to be
 * unnecessary: of 610 products only 41 are visible, and all 41 now carry
 * `details.dimensions`, and every one fits inside 201 x 234mm. The entire
 * sellable catalogue needs two box sizes.
 *
 * WHY WEIGHT IS ESTIMATED. These are flat laser-cut boards, so weight is
 * geometry rather than a measurement: area x thickness x density. That is
 * honest for what it is — an estimate — and the ONE number here that should be
 * checked against a real scale before it prices a real shipment. Estimating
 * low means undercharging on every order, and the shop absorbs it silently.
 * `WEIGHT_SAFETY` exists for that reason, and per-product overrides should beat
 * this whenever someone has actually weighed something.
 */

export type Dimensions = { widthMm: number; heightMm: number };

/** A box we actually stock, and the largest item it will hold. */
export type ParcelPreset = {
  id: string;
  label: string;
  /** Longest side of the ITEM this preset accepts, in mm. */
  maxLongestMm: number;
  /** Shortest side of the ITEM this preset accepts, in mm. */
  maxShortestMm: number;
  boxLengthMm: number;
  boxWidthMm: number;
  /** Empty depth of the box; contents add to it. */
  boxDepthMm: number;
  /** Box, wrapping and filler, in grams. Counted once per parcel. */
  packagingGrams: number;
};

/**
 * Two sizes covers everything sellable: 36 of 40 products have a longest side
 * of 200mm or less, and the remaining four top out at 234mm.
 */
export const PRESETS: ParcelPreset[] = [
  {
    id: "flat-small",
    label: "Small flat box (up to 200 x 160mm)",
    maxLongestMm: 200,
    maxShortestMm: 160,
    boxLengthMm: 215,
    boxWidthMm: 175,
    boxDepthMm: 25,
    packagingGrams: 70,
  },
  {
    id: "flat-large",
    label: "Large flat box (up to 250 x 210mm)",
    maxLongestMm: 250,
    maxShortestMm: 210,
    boxLengthMm: 265,
    boxWidthMm: 225,
    boxDepthMm: 30,
    packagingGrams: 110,
  },
];

/** MDF at ~750 kg/m3, expressed as g/mm3. Plywood is lighter, so this is the safe side. */
const DENSITY_G_PER_MM3 = 0.00075;

/**
 * A finished puzzle is 6mm: two bonded 3mm layers, the cut pieces on a backing
 * board. Sheet stock is 3mm, so 3 is the number that comes to mind and it is
 * the wrong one — it would halve every weight estimate and undercharge the
 * shipping on every single order.
 *
 * Callers may override per item; this is what they get when they do not.
 */
export const DEFAULT_THICKNESS_MM = 6;

/**
 * Rounds the estimate up by a tenth.
 *
 * Not padding for its own sake: glue, paint, engraving depth and the wrapping
 * around each piece all add mass the geometry cannot see, and every one of them
 * pushes the same direction. A carrier that finds the parcel heavier than
 * declared bills the difference to the shop.
 */
const WEIGHT_SAFETY = 1.1;

/**
 * Reads `details.dimensions`, which the catalogue stores as "196mm x 149mm".
 *
 * Returns null rather than a default for anything it cannot read. This is what
 * surfaced "Duck Shape Board" as the one visible product with no dimensions;
 * they were then read off its own product photo. A silent default would have
 * quoted a made-up parcel for it forever instead.
 */
export function parseDimensions(raw: string | null | undefined): Dimensions | null {
  if (!raw) return null;
  const m = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*(mm|cm)?\s*[x×]\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|cm)?/i);
  if (!m) return null;

  // The unit may be written once at the end ("130x156 mm") or on both numbers.
  // Missing entirely, millimetres is right: that is what the catalogue uses.
  const unit = (m[2] || m[4] || "mm").toLowerCase();
  const scale = unit === "cm" ? 10 : 1;

  const widthMm = parseFloat(m[1]) * scale;
  const heightMm = parseFloat(m[3]) * scale;
  if (!(widthMm > 0) || !(heightMm > 0)) return null;
  return { widthMm, heightMm };
}

/**
 * The smallest preset that holds this item, or null if none does.
 *
 * Compares longest-to-longest and shortest-to-shortest, because a board gets
 * turned round to fit the box — a 234 x 201mm item and a 201 x 234mm item are
 * the same parcel.
 */
export function presetFor(d: Dimensions): ParcelPreset | null {
  const longest = Math.max(d.widthMm, d.heightMm);
  const shortest = Math.min(d.widthMm, d.heightMm);
  return (
    PRESETS.find((p) => longest <= p.maxLongestMm && shortest <= p.maxShortestMm) ?? null
  );
}

/** Material weight of one flat piece. Packaging is added once, per parcel. */
export function estimateWeightGrams(d: Dimensions, thicknessMm: number): number {
  return d.widthMm * d.heightMm * thicknessMm * DENSITY_G_PER_MM3 * WEIGHT_SAFETY;
}

export type ParcelItem = {
  /** Raw `details.dimensions` from the catalogue. */
  dimensions: string | null | undefined;
  /** Defaults to DEFAULT_THICKNESS_MM (6mm: two bonded 3mm layers). */
  thicknessMm?: number;
  quantity: number;
};

/** Exactly what a carrier is asked to price. */
export type Parcel = {
  pieces: number;
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  presetId: string;
};

/**
 * One parcel for a whole order.
 *
 * Everything ships together in the largest box the order needs, with the flat
 * pieces stacked — which is how these are actually packed, and cheaper than
 * quoting a parcel per line.
 *
 * Returns null if ANY item cannot be measured. Fail closed: dropping the
 * unreadable item would quote for a lighter parcel than the one actually
 * posted, and nothing downstream would ever notice. A null here should surface
 * as "contact us for a quote", never as a guess.
 */
export function parcelFor(items: ParcelItem[]): Parcel | null {
  if (!items.length) return null;

  let contentsGrams = 0;
  let stackMm = 0;
  let preset: ParcelPreset | null = null;

  for (const item of items) {
    const d = parseDimensions(item.dimensions);
    if (!d) return null;

    const p = presetFor(d);
    if (!p) return null;

    const qty = Math.max(1, Math.floor(item.quantity));
    const thickness = item.thicknessMm ?? DEFAULT_THICKNESS_MM;
    contentsGrams += estimateWeightGrams(d, thickness) * qty;
    stackMm += thickness * qty;

    // Keep the largest box the order needs. PRESETS is ordered smallest first,
    // so a later index is a bigger box.
    if (!preset || PRESETS.indexOf(p) > PRESETS.indexOf(preset)) preset = p;
  }
  if (!preset) return null;

  return {
    pieces: 1,
    weightGrams: Math.ceil(contentsGrams + preset.packagingGrams),
    lengthMm: preset.boxLengthMm,
    widthMm: preset.boxWidthMm,
    // A thick stack makes the parcel deeper than the empty box.
    heightMm: Math.max(preset.boxDepthMm, Math.ceil(stackMm) + 10),
    presetId: preset.id,
  };
}
