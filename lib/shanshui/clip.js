// @ts-nocheck
/*
 * Reshaping captured drawings so neighbouring ones meet cleanly.
 *
 * clipAbove cuts a drawing off at a horizontal line, keeping what lies below it
 * (y down): it gives the corner cliff a flat top for the bookshelf's ledge to
 * cap.
 * Fills are clipped as polygons; their outlines (open polylines) are split into
 * the pieces below the line, so the cut itself is never stroked. Brush strokes
 * are split along their length, each piece ending in a cross-section exactly on
 * the line.
 */

const lerp = (a, b, t) => a + (b - a) * t;
// Fills and outlines shorter than this (world units) are dropped, not cut.
const SMALL = 40;

function yRange(pts) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 1; i < pts.length; i += 2) {
    if (pts[i] < lo) lo = pts[i];
    if (pts[i] > hi) hi = pts[i];
  }
  return [lo, hi];
}

/** Sutherland–Hodgman against the half-plane y >= cut. */
function clipPolygon(pts, cut) {
  const out = [];
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = pts[2 * i];
    const ay = pts[2 * i + 1];
    const bx = pts[2 * j];
    const by = pts[2 * j + 1];
    if (ay >= cut) out.push(ax, ay);
    if (ay >= cut !== by >= cut) out.push(lerp(ax, bx, (cut - ay) / (by - ay)), cut);
  }
  return out;
}

/** The runs of an open polyline that lie below the cut. */
function splitPolyline(pts, cut) {
  const pieces = [];
  let cur = [];
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const x = pts[2 * i];
    const y = pts[2 * i + 1];
    if (i > 0) {
      const px = pts[2 * i - 2];
      const py = pts[2 * i - 1];
      if (py >= cut !== y >= cut) {
        const ix = lerp(px, x, (cut - py) / (y - py));
        cur.push(ix, cut);
        if (y < cut) {
          if (cur.length >= 4) pieces.push(cur);
          cur = [];
        }
      }
    }
    if (y >= cut) cur.push(x, y);
  }
  if (cur.length >= 4) pieces.push(cur);
  return pieces;
}

/** A brush stroke split where its centreline crosses the cut. */
function splitStroke(op, cut, out) {
  const { l, r } = op;
  const n = l.length / 2;
  const cy = (i) => (l[2 * i + 1] + r[2 * i + 1]) / 2;
  const section = (i, j) => {
    // the cross-section where the centreline meets the cut, between i and j
    const t = (cut - cy(i)) / (cy(j) - cy(i));
    return [lerp(l[2 * i], l[2 * j], t), lerp(l[2 * i + 1], l[2 * j + 1], t), lerp(r[2 * i], r[2 * j], t), lerp(r[2 * i + 1], r[2 * j + 1], t)];
  };
  let pl = [];
  let pr = [];
  const flush = () => {
    if (pl.length >= 4) out.push({ ...op, l: pl, r: pr });
    pl = [];
    pr = [];
  };
  for (let i = 0; i < n; i++) {
    const inside = cy(i) >= cut;
    if (i > 0 && inside !== cy(i - 1) >= cut) {
      const [lx, ly, rx, ry] = section(i - 1, i);
      pl.push(lx, ly);
      pr.push(rx, ry);
      if (!inside) flush();
    }
    if (inside) {
      pl.push(l[2 * i], l[2 * i + 1]);
      pr.push(r[2 * i], r[2 * i + 1]);
    }
  }
  flush();
}

const visible = (paint) => paint && paint !== "none" && !/rgba\([^)]*,\s*0\)$/.test(paint);

/**
 * A mountain's white backing (its first white fill: the outline closed by a
 * point under its middle) dips below the base in a straight-edged wedge, which
 * slices through whatever stands behind it there. This closes it straight
 * across the base instead, so what's behind disappears at the waterline.
 */
export function flatBase(ops) {
  const i = ops.findIndex((op) => op.k === "p" && op.fil === "white");
  if (i < 0) return ops;
  const out = ops.slice();
  out[i] = { ...ops[i], pts: ops[i].pts.slice(0, -2) };
  return out;
}

/** Keeps the parts of ops at or below y = cut. */
export function clipAbove(ops, cut) {
  const out = [];
  for (const op of ops) {
    if (op.k === "s") {
      const [, hi] = yRange(op.l.concat(op.r));
      if (hi < cut) continue;
      if (yRange(op.l.concat(op.r))[0] >= cut) out.push(op);
      else splitStroke(op, cut, out);
      continue;
    }
    const [lo, hi] = yRange(op.pts);
    if (hi < cut) continue;
    if (lo >= cut) {
      out.push(op);
      continue;
    }
    if (op.k === "f") {
      const pts = clipPolygon(op.pts, cut);
      if (pts.length >= 6) out.push({ ...op, pts });
      continue;
    }
    // a small blot across the line (a tree's crown on the old ridge) goes
    // whole: cut flat, it would read as a stump
    if (hi - lo < SMALL) continue;
    if (visible(op.fil)) {
      const pts = clipPolygon(op.pts, cut);
      if (pts.length >= 6) out.push({ ...op, pts, str: "none", wid: 0 });
    }
    if (visible(op.str) && op.wid > 0) {
      for (const pts of splitPolyline(op.pts, cut)) out.push({ ...op, pts, fil: "none" });
    }
  }
  return out;
}
