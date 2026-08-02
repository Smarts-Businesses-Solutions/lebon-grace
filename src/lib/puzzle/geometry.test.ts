/**
 * Tests for the cut-file validator.
 *
 * Every case is a shape that either can or cannot be cut from 3mm MDF, so the
 * assertions are about physical outcomes rather than numbers for their own sake.
 *
 * Negative assertions are always paired with a positive one on the same shape
 * family. "No neck found" proves nothing if the detector is broken and finds
 * nothing anywhere, so each clean shape sits next to a pinched version of
 * itself that must be caught.
 */
import { describe, it, expect } from "vitest";
import {
  Ring,
  area,
  isClockwise,
  pointInRing,
  interiorPoint,
  findThinNecks,
  findSelfIntersections,
  classifyRings,
  validateCutFile,
  MIN_FEATURE_MM,
} from "./geometry";

const rect = (x: number, y: number, w: number, h: number): Ring => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/** A dumbbell: two blobs joined by a neck of the given width. */
const dumbbell = (neckWidth: number): Ring => {
  const half = neckWidth / 2;
  return [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 20 - half },
    { x: 50, y: 20 - half },
    { x: 50, y: 0 },
    { x: 80, y: 0 },
    { x: 80, y: 40 },
    { x: 50, y: 40 },
    { x: 50, y: 20 + half },
    { x: 30, y: 20 + half },
    { x: 30, y: 40 },
    { x: 0, y: 40 },
  ];
};

describe("primitives", () => {
  it("measures area in mm²", () => {
    expect(area(rect(0, 0, 10, 20))).toBeCloseTo(200);
  });

  it("distinguishes winding direction, which is how holes are told from outlines", () => {
    const ccw = rect(0, 0, 10, 10);
    const cw = [...ccw].reverse();
    expect(isClockwise(ccw)).toBe(false);
    expect(isClockwise(cw)).toBe(true);
  });

  it("finds an interior point for a C shape, where the centroid falls outside", () => {
    const c: Ring = [
      { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 8 }, { x: 8, y: 8 },
      { x: 8, y: 22 }, { x: 30, y: 22 }, { x: 30, y: 30 }, { x: 0, y: 30 },
    ];
    const centroid = c.reduce((a, p) => ({ x: a.x + p.x / c.length, y: a.y + p.y / c.length }), { x: 0, y: 0 });
    expect(pointInRing(centroid, c)).toBe(false); // the trap this guards against
    expect(pointInRing(interiorPoint(c), c)).toBe(true);
  });
});

describe("thin necks", () => {
  it("passes a neck comfortably above the minimum", () => {
    expect(findThinNecks(dumbbell(6), MIN_FEATURE_MM)).toHaveLength(0);
  });

  it("catches a neck below the minimum", () => {
    const found = findThinNecks(dumbbell(1), MIN_FEATURE_MM);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].kind).toBe("thin-neck");
    expect(found[0].measured).toBeLessThan(MIN_FEATURE_MM);
  });

  it("does not report adjacent vertices on a small but healthy shape", () => {
    // A 4mm-wide bar is thin but every narrow pair is adjacent along the path,
    // so it is not a pinch. This is the false positive that makes the path
    // separation rule necessary.
    expect(findThinNecks(rect(0, 0, 4, 60), MIN_FEATURE_MM)).toHaveLength(0);
  });

  it("reports a given neck once, not once per vertex pair", () => {
    expect(findThinNecks(dumbbell(1), MIN_FEATURE_MM).length).toBeLessThanOrEqual(2);
  });
});

describe("self intersection", () => {
  it("accepts a simple rectangle", () => {
    expect(findSelfIntersections(rect(0, 0, 10, 10))).toHaveLength(0);
  });

  it("catches a bowtie", () => {
    const bowtie: Ring = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    expect(findSelfIntersections(bowtie).length).toBeGreaterThan(0);
  });
});

describe("islands", () => {
  it("accepts a letter O: outline plus its counter, and no island", () => {
    const outer = rect(0, 0, 40, 40);
    const counter = [...rect(10, 10, 20, 20)].reverse();
    const { depths, findings } = classifyRings([outer, counter]);
    expect(depths).toEqual([0, 1]);
    expect(findings).toHaveLength(0);
  });

  it("catches a dot inside the counter, which would drop out of the sheet", () => {
    const outer = rect(0, 0, 40, 40);
    const counter = [...rect(10, 10, 20, 20)].reverse();
    const dot = rect(16, 16, 8, 8); // depth 2: inside the hole
    const { depths, findings } = classifyRings([outer, counter, dot]);
    expect(depths[2]).toBe(2);
    expect(findings.some((f) => f.kind === "island")).toBe(true);
  });
});

describe("validateCutFile", () => {
  it("passes a plain rectangle big enough to hold", () => {
    const r = validateCutFile([rect(0, 0, 60, 40)]);
    expect(r.ok).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  it("fails a pinched shape and says why", () => {
    const r = validateCutFile([dumbbell(0.8)]);
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.kind === "thin-neck")).toBe(true);
    expect(r.findings[0].message).toMatch(/snap/i);
  });

  it("warns on a tiny piece without failing the file", () => {
    const r = validateCutFile([rect(0, 0, 5, 5)]); // 25mm², under the 100 guide
    expect(r.findings.some((f) => f.kind === "tiny-piece")).toBe(true);
    expect(r.ok).toBe(true); // warning only
  });

  it("rejects a degenerate path", () => {
    const r = validateCutFile([[{ x: 0, y: 0 }, { x: 1, y: 1 }]]);
    expect(r.ok).toBe(false);
    expect(r.findings[0].kind).toBe("open-path");
  });
});
