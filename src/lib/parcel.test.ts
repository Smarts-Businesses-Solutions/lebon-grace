import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseDimensions, presetFor, estimateWeightGrams, parcelFor, PRESETS, DEFAULT_THICKNESS_MM } from "./parcel";

/**
 * Parcel presets — the physical data every carrier demands and this shop has
 * never held.
 *
 * `CreateBooking` on Emirates Post requires Pieces, Weight, WeightUnit, Length,
 * Width, Height and DimensionUnit; DHL, Shippo and EasyPost all want the same.
 * None of it existed here, so no carrier could be asked for a rate.
 *
 * The catalogue made this far smaller than feared. Of 610 products only 41 are
 * visible, 40 of those already carry `details.dimensions` as "196mm x 149mm",
 * and the whole range fits 45-201mm by 73-234mm — one or two box sizes.
 *
 * Weight is the genuine gap, and for flat laser-cut boards it is calculable
 * rather than measurable: area x thickness x density.
 */

describe("parseDimensions", () => {
  it("reads the shape the catalogue actually stores", () => {
    expect(parseDimensions("196mm x 149mm")).toEqual({ widthMm: 196, heightMm: 149 });
  });

  it("tolerates the spacing and case variations in real data", () => {
    expect(parseDimensions("130mm x 156mm")).toEqual({ widthMm: 130, heightMm: 156 });
    expect(parseDimensions("130 mm X 156 mm")).toEqual({ widthMm: 130, heightMm: 156 });
    expect(parseDimensions("130x156")).toEqual({ widthMm: 130, heightMm: 156 });
  });

  it("converts centimetres, because a mm-only parser would under-read by 10x", () => {
    // Silently treating "13cm x 15.6cm" as 13mm x 15.6mm would pick the
    // smallest box and under-quote the shipping on every such product.
    expect(parseDimensions("13cm x 15.6cm")).toEqual({ widthMm: 130, heightMm: 156 });
  });

  it("returns null rather than guessing when it cannot read the value", () => {
    // "Duck Shape Board" shipped with no dimensions at all until they were
    // read off its own product photo (130 x 130mm) on 2026-08-12. A parser
    // that invented a default would have hidden that gap instead of exposing
    // it — the catalogue is now complete precisely because it did not.
    for (const bad of ["", "medium", "assorted sizes", "196mm"]) {
      expect(parseDimensions(bad), `should not parse: ${bad}`).toBeNull();
    }
  });
});

describe("presetFor", () => {
  it("puts the bulk of the catalogue in the smallest box", () => {
    // 36 of 40 products have a longest side <= 200mm.
    expect(presetFor({ widthMm: 196, heightMm: 149 })?.id).toBe("flat-small");
  });

  it("moves the four oversized boards up a size", () => {
    // Largest real product is 201 x 234mm.
    expect(presetFor({ widthMm: 201, heightMm: 234 })?.id).toBe("flat-large");
  });

  it("is orientation-independent", () => {
    // A board is not wider than it is tall in any meaningful sense — it gets
    // turned round to fit the box. Comparing raw width to raw width would
    // wrongly upgrade half the catalogue.
    expect(presetFor({ widthMm: 234, heightMm: 201 })?.id).toBe("flat-large");
  });

  it("returns null for something no preset can hold, instead of overflowing", () => {
    // Better to refuse and make someone look than to promise a rate for a box
    // the item does not fit in.
    expect(presetFor({ widthMm: 900, heightMm: 900 })).toBeNull();
  });

  it("every preset's inner size actually exceeds its own limit", () => {
    // A preset whose box is smaller than what it accepts would produce parcels
    // that cannot be packed.
    for (const p of PRESETS) {
      expect(p.boxLengthMm, `${p.id} box shorter than its limit`).toBeGreaterThan(p.maxLongestMm);
      expect(p.boxWidthMm, `${p.id} box narrower than its limit`).toBeGreaterThan(p.maxShortestMm);
    }
  });
});

describe("estimateWeightGrams", () => {
  it("derives a plausible weight for a typical board", () => {
    // 196 x 149 x 3mm of MDF at 750 kg/m3 is about 66g of material.
    const g = estimateWeightGrams({ widthMm: 196, heightMm: 149 }, 3);
    expect(g).toBeGreaterThan(55);
    expect(g).toBeLessThan(80);
  });

  it("scales with area and with thickness", () => {
    const base = estimateWeightGrams({ widthMm: 100, heightMm: 100 }, 3);
    expect(estimateWeightGrams({ widthMm: 200, heightMm: 100 }, 3)).toBeCloseTo(base * 2, 1);
    expect(estimateWeightGrams({ widthMm: 100, heightMm: 100 }, 6)).toBeCloseTo(base * 2, 1);
  });
});

describe("parcelFor — what actually gets sent to a carrier", () => {
  const board = { dimensions: "196mm x 149mm", thicknessMm: 3, quantity: 1 };

  it("adds packaging weight, because carriers weigh the box too", () => {
    const p = parcelFor([board])!;
    const contentsOnly = estimateWeightGrams({ widthMm: 196, heightMm: 149 }, 3);
    expect(p.weightGrams).toBeGreaterThan(contentsOnly);
  });

  it("stacks multiples into one parcel rather than quoting several", () => {
    const one = parcelFor([board])!;
    const three = parcelFor([{ ...board, quantity: 3 }])!;

    expect(three.pieces).toBe(1);
    // Three boards weigh more than one, but not three times — the box and
    // wrapping are counted once.
    expect(three.weightGrams).toBeGreaterThan(one.weightGrams);
    expect(three.weightGrams).toBeLessThan(one.weightGrams * 3);
  });

  it("keeps the box the same size while the contents still fit inside it", () => {
    // This assertion started out backwards: it demanded that three boards make
    // a DEEPER parcel than one. They do not. A small flat box is 25mm deep
    // whether it holds one 3mm board or three, and the carrier measures the
    // box, not the contents. Only weight changes here.
    const one = parcelFor([board])!;
    const three = parcelFor([{ ...board, quantity: 3 }])!;
    expect(three.heightMm).toBe(one.heightMm);
  });

  it("but does grow the parcel once the stack outgrows the box", () => {
    // The pair that makes the test above meaningful. Without this, "size never
    // changes" would also pass on code that ignored the contents entirely and
    // happily quoted a 25mm box for a 60mm stack.
    const many = parcelFor([{ ...board, quantity: 20 }])!;
    const one = parcelFor([board])!;
    expect(many.heightMm).toBeGreaterThan(one.heightMm);
    expect(many.heightMm).toBeGreaterThanOrEqual(20 * 3);
  });

  it("sizes the box to the LARGEST item in a mixed order", () => {
    const p = parcelFor([board, { dimensions: "201mm x 234mm", thicknessMm: 3, quantity: 1 }])!;
    expect(p.lengthMm).toBeGreaterThanOrEqual(234);
  });

  it("refuses the whole parcel when any item has no usable dimensions", () => {
    // Fail closed. Skipping the unreadable item would quietly quote for a
    // lighter parcel than the one actually posted, and the shop eats the
    // difference on every such order.
    expect(parcelFor([board, { dimensions: "", thicknessMm: 3, quantity: 1 }])).toBeNull();
  });

  it("refuses an empty cart rather than returning a zero-weight parcel", () => {
    expect(parcelFor([])).toBeNull();
  });
});

describe("the real catalogue", () => {
  /**
   * Every dimension string on a VISIBLE product, taken from production on
   * 2026-08-12 and committed as a fixture.
   *
   * Unit tests with invented inputs prove the parser handles what I imagined.
   * This proves it handles what the shop actually sells — and it fails loudly
   * the day someone adds a product too big for either box, which is exactly
   * when a quiet fallback would start under-quoting real shipments.
   */
  const dims = readFileSync(
    new URL("./__fixtures__/catalogue-dimensions.txt", import.meta.url),
    "utf8"
  ).split("\n").map((s) => s.trim()).filter(Boolean);

  it("has a fixture to check against", () => {
    // Precondition. Without it, an empty file would make every loop below pass
    // vacuously — the "never assert only absence" trap.
    expect(dims.length).toBeGreaterThan(30);
  });

  it("parses every dimension string in the catalogue", () => {
    const failed = dims.filter((d) => parseDimensions(d) === null);
    expect(failed, `unparsed: ${failed.join(", ")}`).toEqual([]);
  });

  it("fits every real product into a preset", () => {
    const homeless = dims.filter((d) => !presetFor(parseDimensions(d)!));
    expect(homeless, `no box fits: ${homeless.join(", ")}`).toEqual([]);
  });

  it("keeps a single-item parcel inside a sane weight for a hand-made puzzle", () => {
    // A wooden puzzle in a flat box is a few hundred grams. If this ever
    // reports kilograms the density or the unit handling has drifted, and
    // every quote built on it would be wrong.
    for (const d of dims) {
      const p = parcelFor([{ dimensions: d, quantity: 1 }])!;
      expect(p, `no parcel for ${d}`).not.toBeNull();
      expect(p.weightGrams, `${d} too light`).toBeGreaterThan(80);
      expect(p.weightGrams, `${d} implausibly heavy`).toBeLessThan(600);
    }
  });
});

describe("default thickness", () => {
  it("assumes 6mm — a finished puzzle is two bonded 3mm layers", () => {
    expect(DEFAULT_THICKNESS_MM).toBe(6);
  });

  it("weighs a default item as the 6mm one, not the 3mm sheet", () => {
    // Getting this wrong halves every estimate and undercharges every order,
    // which is invisible until the carrier invoice arrives.
    const dflt = parcelFor([{ dimensions: "196mm x 149mm", quantity: 1 }])!;
    const three = parcelFor([{ dimensions: "196mm x 149mm", thicknessMm: 3, quantity: 1 }])!;
    const six = parcelFor([{ dimensions: "196mm x 149mm", thicknessMm: 6, quantity: 1 }])!;
    expect(dflt.weightGrams).toBe(six.weightGrams);
    expect(dflt.weightGrams).toBeGreaterThan(three.weightGrams);
  });
});
