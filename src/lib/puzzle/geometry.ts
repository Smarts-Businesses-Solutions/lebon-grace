/**
 * Geometry checks for laser-cut viability.
 *
 * This is the shared core beneath both custom-puzzle features. Tracing an image
 * and laying out a name look like different problems, but they fail in exactly
 * the same three ways, and every one of them produces scrap rather than an
 * error: the laser cuts whatever it is given.
 *
 * All coordinates are MILLIMETRES. SVG user units are unitless, so the caller is
 * responsible for emitting a viewBox that makes 1 unit = 1mm. Getting this wrong
 * silently scales every threshold here.
 *
 * Curves are flattened to polylines before any check runs. A neck is a neck
 * whether its sides are straight or Bezier, and working in one representation
 * keeps the checks honest.
 */

/** A point in millimetres. */
export type Pt = { x: number; y: number };

/** A closed ring of points. First and last point are NOT duplicated. */
export type Ring = Pt[];

/**
 * Material constants for 3mm MDF on a diode/CO2 laser.
 *
 * MIN_FEATURE_MM is the width below which a neck snaps when a child pulls the
 * piece out. It is deliberately conservative: the cost of rejecting a design is
 * an apology, the cost of accepting a bad one is a wasted sheet plus a remake.
 *
 * KERF_MM is the width the beam removes. It matters because two cuts closer
 * together than the kerf merge into one, so a 0.3mm gap between pieces is not a
 * gap at all.
 */
export const MIN_FEATURE_MM = 2.0;
export const KERF_MM = 0.2;
export const MIN_PIECE_AREA_MM2 = 100; // ~10x10mm; smaller is a choking hazard and a fiddle to cut

export type Severity = "error" | "warning";

export type Finding = {
  kind: "open-path" | "self-intersection" | "thin-neck" | "island" | "tiny-piece";
  severity: Severity;
  message: string;
  /** Where to look, in mm. Lets the UI point at the problem. */
  at?: Pt;
  /** The measured value that tripped the check, in mm or mm². */
  measured?: number;
};

/* ─────────────────────────── primitives ─────────────────────────── */

export function distance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Twice the signed area. Positive and negative rings wind opposite ways, which
 * is how a hole is told apart from an outline in the even-odd/nonzero sense.
 */
export function signedArea2(ring: Ring): number {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

export function area(ring: Ring): number {
  return Math.abs(signedArea2(ring)) / 2;
}

export function isClockwise(ring: Ring): boolean {
  return signedArea2(ring) < 0;
}

/** Perimeter length, used to reason about how far apart two points are along the ring. */
export function perimeter(ring: Ring): number {
  let p = 0;
  for (let i = 0, n = ring.length; i < n; i++) p += distance(ring[i], ring[(i + 1) % n]);
  return p;
}

export function pointInRing(pt: Pt, ring: Ring): boolean {
  // Ray casting. Counts crossings of a horizontal ray to the right of pt.
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const straddles = a.y > pt.y !== b.y > pt.y;
    if (straddles && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/* ─────────────────────────── checks ─────────────────────────── */

/**
 * Finds necks: pairs of points that sit close together in space but far apart
 * along the outline.
 *
 * The "far apart along the outline" half is what makes this a pinch rather than
 * two neighbouring points, which are of course close together. Without that
 * condition every vertex on the path reports as a neck.
 *
 * O(n^2) over ring vertices. Simplify before calling: a few hundred points is
 * instant, tens of thousands straight off a trace is not.
 */
export function findThinNecks(ring: Ring, minWidth = MIN_FEATURE_MM): Finding[] {
  const findings: Finding[] = [];
  const n = ring.length;
  if (n < 6) return findings;

  // Cumulative distance along the ring, so path separation is a subtraction.
  const cum: number[] = [0];
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + distance(ring[i - 1], ring[i]);
  const total = cum[n - 1] + distance(ring[n - 1], ring[0]);

  // Two points must be at least this far apart along the outline to count as a
  // pinch. Below it they are simply adjacent geometry.
  const minPathSeparation = Math.max(minWidth * 3, total * 0.02);

  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const along = Math.min(cum[j] - cum[i], total - (cum[j] - cum[i]));
      if (along < minPathSeparation) continue;
      const d = distance(ring[i], ring[j]);
      if (d >= minWidth) continue;

      // One finding per neighbourhood, otherwise a single neck reports dozens of
      // times and buries everything else.
      const key = `${Math.round(ring[i].x / minWidth)},${Math.round(ring[i].y / minWidth)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      findings.push({
        kind: "thin-neck",
        severity: "error",
        measured: d,
        at: { x: (ring[i].x + ring[j].x) / 2, y: (ring[i].y + ring[j].y) / 2 },
        message: `Neck ${d.toFixed(2)}mm wide, below the ${minWidth}mm minimum for 3mm MDF. It will snap.`,
      });
    }
  }
  return findings;
}

/**
 * Classifies rings into outlines, holes, and islands.
 *
 * An island is a ring sitting inside a hole: the counter of an `O` is a hole in
 * the letter, but if something is drawn inside that counter it is a separate
 * piece with nothing holding it. On the bed it drops through.
 *
 * Nesting depth decides: even depth is solid material, odd depth is a hole. A
 * ring at depth >= 2 is an island.
 */
export function classifyRings(rings: Ring[]): {
  depths: number[];
  findings: Finding[];
} {
  const depths = rings.map((r, i) => {
    // Containment is tested with a VERTEX of the ring, not a point in its
    // interior.
    //
    // Using an interior point is wrong and fails on the commonest shape there
    // is: for a letter O, the centre of the outline lies inside the counter, so
    // the outline was reported as nested within its own hole (depth 1) and the
    // whole classification shifted by one.
    //
    // A vertex sits on the boundary of its own ring, which is why self is
    // skipped, but against any OTHER non-intersecting ring it is unambiguously
    // in or out, and it is in exactly when the whole ring is.
    const probe = r[0];
    let depth = 0;
    rings.forEach((other, j) => {
      if (i === j) return;
      if (pointInRing(probe, other)) depth++;
    });
    return depth;
  });

  const findings: Finding[] = [];
  depths.forEach((d, i) => {
    if (d >= 2) {
      findings.push({
        kind: "island",
        severity: "error",
        at: interiorPoint(rings[i]),
        message:
          "Floating island: this shape sits inside a hole with nothing joining it to the rest. " +
          "It will fall out of the sheet when cut. Bridge it, or engrave it instead of cutting it.",
      });
    }
  });
  return { depths, findings };
}

/**
 * A point strictly inside the ring.
 *
 * The centroid is not safe: for a crescent or a `C` it lands outside the shape.
 * This walks midpoints of a triangulation-free fan until one tests inside,
 * falling back to the centroid only if every candidate fails.
 */
export function interiorPoint(ring: Ring): Pt {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 2) % n];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (pointInRing(mid, ring)) return mid;
  }
  const c = ring.reduce((acc, p) => ({ x: acc.x + p.x / n, y: acc.y + p.y / n }), { x: 0, y: 0 });
  return c;
}

/** Segment intersection, excluding shared endpoints of adjacent segments. */
function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-12) return false; // parallel
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  const eps = 1e-9;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}

/**
 * Self-intersection. A traced outline that crosses itself cuts a shape that is
 * not the one on screen, and the customer only finds out when it arrives.
 */
export function findSelfIntersections(ring: Ring): Finding[] {
  const findings: Finding[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // adjacent across the wrap
      const b1 = ring[j];
      const b2 = ring[(j + 1) % n];
      if (segmentsCross(a1, a2, b1, b2)) {
        findings.push({
          kind: "self-intersection",
          severity: "error",
          at: a1,
          message: "The outline crosses itself here, so the cut would not follow the shape shown.",
        });
        return findings; // one is enough; the design needs redrawing either way
      }
    }
  }
  return findings;
}

/**
 * Full report for a set of rings making up one cut file.
 *
 * Returns every finding rather than stopping at the first, because a customer
 * fixing their artwork wants the whole list, not one problem at a time.
 */
export function validateCutFile(
  rings: Ring[],
  opts: { minFeature?: number; minPieceArea?: number } = {}
): { ok: boolean; findings: Finding[] } {
  const minFeature = opts.minFeature ?? MIN_FEATURE_MM;
  const minPieceArea = opts.minPieceArea ?? MIN_PIECE_AREA_MM2;
  const findings: Finding[] = [];

  for (const ring of rings) {
    if (ring.length < 3) {
      findings.push({
        kind: "open-path",
        severity: "error",
        message: "A path has fewer than three points, so it encloses nothing and cannot be cut.",
      });
      continue;
    }
    findings.push(...findSelfIntersections(ring));
    findings.push(...findThinNecks(ring, minFeature));
  }

  findings.push(...classifyRings(rings).findings);

  // Tiny pieces are a warning, not an error: a deliberate small detail is
  // legitimate, but it is worth telling the workshop before it cuts.
  const { depths } = classifyRings(rings);
  rings.forEach((ring, i) => {
    if (depths[i] % 2 !== 0) return; // holes have no piece area of their own
    const a = area(ring);
    if (a < minPieceArea) {
      findings.push({
        kind: "tiny-piece",
        severity: "warning",
        measured: a,
        at: interiorPoint(ring),
        message: `Piece is ${a.toFixed(0)}mm², under the ${minPieceArea}mm² guide. Fiddly to cut and a swallowing risk for under-threes.`,
      });
    }
  });

  return { ok: !findings.some((f) => f.severity === "error"), findings };
}
