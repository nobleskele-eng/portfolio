/*
 * The "stayvyxed" title, faint, behind the intro. Each letter is a few brush
 * strokes, built the way shan-shui builds its own (a centreline pushed out
 * either side by a noisy, tapering width), so the title reads as the same ink
 * as the mountains. While the landscape paints in, the title un-writes itself
 * the way the landscape inks in, run backwards: it drains into a few points at
 * once, the strokes furthest from them going first, each pulling back into the
 * brush with a pointed tip while it thins and fades.
 */

export const TITLE_TEXT = "stayvyxed";

// Glyphs: centreline paths (absolute M/L/C) on a grid where the baseline is
// y = 0 and the x-height is y = −100, listed in writing order.
const GLYPHS: Record<string, { adv: number; strokes: string[] }> = {
  s: { adv: 62, strokes: ["M56 -84 C48 -100 14 -102 12 -78 C10 -58 54 -56 56 -28 C58 -2 18 4 2 -14"] },
  t: { adv: 56, strokes: ["M26 -148 C25 -100 22 -44 25 -16 C27 4 44 4 54 -8", "M4 -94 C20 -95 38 -97 56 -100"] },
  a: { adv: 76, strokes: ["M60 -80 C50 -102 10 -102 6 -52 C3 -14 36 -2 60 -38", "M64 -98 C62 -62 59 -26 64 -6 C66 2 72 2 78 -6"] },
  y: { adv: 74, strokes: ["M4 -98 C10 -64 18 -34 38 -8", "M72 -100 C60 -52 44 -6 28 38 C20 60 6 70 -6 58"] },
  v: { adv: 72, strokes: ["M2 -98 C12 -66 24 -32 36 -2", "M36 -2 C46 -36 56 -70 72 -100"] },
  x: { adv: 72, strokes: ["M4 -98 C24 -66 46 -32 70 -2", "M70 -98 C48 -66 26 -32 2 -2"] },
  e: { adv: 66, strokes: ["M8 -50 C28 -48 50 -54 58 -68 C62 -88 42 -104 24 -96 C4 -86 0 -44 10 -22 C22 2 48 2 62 -14"] },
  d: { adv: 80, strokes: ["M58 -80 C48 -102 8 -102 4 -52 C1 -14 34 -2 58 -38", "M66 -164 C64 -100 60 -30 66 -6 C68 2 74 2 80 -6"] },
};
const LETTER_GAP = 12;
// Lean to the right, like a quick hand.
const SLANT = 0.14;
// Half the brush's width at full pressure, and how far apart centreline points sit.
const HALF_W = 6;
const STEP = 2;
// Points over which a retracting stroke tapers to its tip.
const TIP = 7;
const INK = "rgba(34, 31, 27, 0.9)";
const BLEED = "rgba(34, 31, 27, 0.07)";
// The whole title's strength: it sits faint, behind the landscape.
const OPACITY = 0.42;
// Where the title drains to, as shares of its width (along its middle).
const DROPS = [0.13, 0.5, 0.84];
// Share of the un-writing each stroke spends retracting, and how far its turn
// is thrown off the front (the spatter).
const STROKE_SHARE = 0.45;
const SPATTER = 0.18;
// Like the landscape's ops: full strength until this far back, and down to
// this share of its width by the time it's gone.
const FADE_SHARE = 0.7;
const BLOOM = 0.7;

interface Stroke {
  n: number;
  x: Float32Array;
  y: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  w: Float32Array;
  /** when this stroke starts retracting, as a share of the un-writing */
  begin: number;
}

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth 1D value noise in −1..1. */
function noise(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
}

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** Points along an absolute M/L/C path, densely enough to resample. */
function trace(d: string): [number, number][] {
  const tok = d.match(/[MLC]|-?\d*\.?\d+/g) ?? [];
  const out: [number, number][] = [];
  let cmd = "M";
  let i = 0;
  let cx = 0;
  let cy = 0;
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (/[MLC]/.test(tok[i])) cmd = tok[i++];
    if (cmd === "M" || cmd === "L") {
      cx = num();
      cy = num();
      out.push([cx, cy]);
    } else {
      const [x1, y1, x2, y2, x, y] = [num(), num(), num(), num(), num(), num()];
      for (let k = 1; k <= 24; k++) {
        const t = k / 24;
        const m = 1 - t;
        out.push([
          m * m * m * cx + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x,
          m * m * m * cy + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y,
        ]);
      }
      cx = x;
      cy = y;
    }
  }
  return out;
}

/** Evenly spaced points by arc length. */
function resample(pts: [number, number][], step: number): [number, number][] {
  const out: [number, number][] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const seg = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= seg) {
      const t = d / seg;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      d += step;
    }
    carry = seg - (d - step);
  }
  const last = pts[pts.length - 1];
  const end = out[out.length - 1];
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > step * 0.3) out.push(last);
  return out;
}

/** A brush stroke: pressure rises at the start, tails off at the end, and is heavier going down. */
function brush(pts: [number, number][], seed: number): Omit<Stroke, "begin"> {
  const n = pts.length;
  const s: Omit<Stroke, "begin"> = {
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    nx: new Float32Array(n),
    ny: new Float32Array(n),
    w: new Float32Array(n),
  };
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / len;
    const ty = (b[1] - a[1]) / len;
    const t = n > 1 ? i / (n - 1) : 0;
    const attack = 0.35 + 0.65 * smooth(t / 0.1);
    const release = 0.12 + 0.88 * (1 - smooth((t - 0.7) / 0.3));
    const press = 0.62 + 0.38 * Math.max(0, Math.min(1, ty * 0.8 + 0.35));
    const wob = 1 + 0.2 * noise(i * 0.09 + seed * 17.3);
    s.x[i] = px;
    s.y[i] = py;
    s.nx[i] = -ty;
    s.ny[i] = tx;
    s.w[i] = HALF_W * attack * release * press * wob;
  }
  return s;
}

/** The title's strokes in writing order, each with its turn to go, and its bounding box (grid units). */
function build() {
  const strokes: Stroke[] = [];
  let pen = 0;
  let seed = 1;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const ch of TITLE_TEXT) {
    const g = GLYPHS[ch];
    for (const d of g.strokes) {
      const pts = resample(
        trace(d).map(([x, y]) => [pen + x - y * SLANT, y] as [number, number]),
        STEP,
      );
      const b = brush(pts, seed++);
      strokes.push({ ...b, begin: 0 });
      for (let i = 0; i < b.n; i++) {
        x0 = Math.min(x0, b.x[i] - HALF_W);
        x1 = Math.max(x1, b.x[i] + HALF_W);
        y0 = Math.min(y0, b.y[i] - HALF_W);
        y1 = Math.max(y1, b.y[i] + HALF_W);
      }
    }
    pen += g.adv + LETTER_GAP;
  }
  // the further a stroke's middle is from the nearest drop, the sooner it goes
  const my = (y0 + y1) / 2;
  const away = strokes.map((st) => {
    const m = st.n >> 1;
    return Math.min(...DROPS.map((f) => Math.hypot(st.x[m] - (x0 + (x1 - x0) * f), st.y[m] - my)));
  });
  const far = Math.max(...away);
  strokes.forEach((st, i) => {
    const turn = (1 - away[i] / far) * (1 - SPATTER) + hash(i * 3.7 + 5) * SPATTER;
    st.begin = Math.max(0, Math.min(1, turn)) * (1 - STROKE_SHARE);
  });
  return { strokes, box: { x0, y0, x1, y1 } };
}

/** What a stroke's outline is traced into: a canvas context, or an SVG path. */
interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
}

/** One stroke's outline up to point k (fractional), its edges jittered like a dry brush. */
function traceStroke(out: PathSink, s: Stroke, k: number, grow: number) {
  const full = k >= s.n - 1;
  const end = Math.min(s.n - 1, k);
  const last = Math.floor(end);
  const tip = (i: number) => (full ? 1 : 0.15 + 0.85 * Math.min(1, (end - i) / TIP));
  const edge = (i: number, side: number) => {
    const j = 0.6 * noise(i * 1.7 + side * 31);
    const w = (s.w[i] * tip(i) + j) * grow;
    return [s.x[i] + side * s.nx[i] * w, s.y[i] + side * s.ny[i] * w];
  };
  out.moveTo(s.x[0], s.y[0]);
  for (let i = 0; i <= last; i++) {
    const [x, y] = edge(i, 1);
    out.lineTo(x, y);
  }
  if (!full) {
    // the tip, between the last whole point and the next
    const f = end - last;
    out.lineTo(s.x[last] + (s.x[last + 1] - s.x[last]) * f, s.y[last] + (s.y[last + 1] - s.y[last]) * f);
  }
  for (let i = last; i >= 0; i--) {
    const [x, y] = edge(i, -1);
    out.lineTo(x, y);
  }
}

function fillStroke(ctx: CanvasRenderingContext2D, s: Stroke, k: number, grow: number) {
  ctx.beginPath();
  traceStroke(ctx, s, k, grow);
  ctx.closePath();
  ctx.fill();
}

/** The two passes of ink, bleed first: colour and how far the brush spreads. */
const LAYERS = [
  [BLEED, 1.5],
  [INK, 1],
] as const;

/**
 * The whole title as it first stands, as SVG for the server-rendered page, so
 * it's up before any script runs: the same strokes at the same strength, in
 * grid units (`box` is the viewBox). The canvas takes over seamlessly.
 */
export function titleSvg() {
  const { strokes, box } = build();
  const layers = LAYERS.map(([fill, grow]) => ({
    fill,
    paths: strokes.map((st) => {
      let d = "";
      const at = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
      traceStroke({ moveTo: (x, y) => (d += `M${at(x, y)}`), lineTo: (x, y) => (d += `L${at(x, y)}`) }, st, st.n - 1, grow);
      return `${d}Z`;
    }),
  }));
  return { box, opacity: OPACITY, layers };
}

/**
 * How the title is sized and placed on the stage, which the canvas and the
 * server-rendered SVG both follow: as wide as a share of the stage (more on a
 * tall one) but no wider than maxPx or taller than a share of the always-
 * visible height, centred at centreY down it.
 */
export const TITLE_FIT = { tallBelow: 0.8, tallShare: 0.84, wideShare: 0.56, maxPx: 1100, heightShare: 0.3, centreY: 0.46 };

export class IntroTitle {
  private ctx: CanvasRenderingContext2D;
  private title = build();
  private cssW = 0;
  private cssH = 0;
  private safeH = 0;
  private dpr = 1;
  private shown = -1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  }

  /** The canvas is cssW × cssH; the title is centred in its top safeH (see InkRenderer.resize). */
  resize(cssW: number, cssH: number, dpr: number, safeH = cssH) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.safeH = Math.min(cssH, safeH || cssH);
    this.dpr = Math.min(2, dpr || 1);
    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    const p = this.shown;
    this.shown = -1;
    if (p >= 0) this.draw(p);
  }

  /** p: how far the un-writing has got, 0 (whole title) to 1 (gone). */
  draw(p: number) {
    if (p === this.shown || !this.cssW) return;
    this.shown = p;
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (p >= 1) return;

    const { strokes, box } = this.title;
    const F = TITLE_FIT;
    const tall = this.cssW / this.safeH < F.tallBelow;
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    const s = Math.min((this.cssW * (tall ? F.tallShare : F.wideShare)) / bw, F.maxPx / bw, (this.safeH * F.heightShare) / bh);
    // centred, a touch above the middle so it sits right optically
    const ox = this.cssW / 2 - (box.x0 + bw / 2) * s;
    const oy = this.safeH * F.centreY - (box.y0 + bh / 2) * s;
    ctx.setTransform(s * this.dpr, 0, 0, s * this.dpr, ox * this.dpr, oy * this.dpr);

    for (const [style, grow] of LAYERS) {
      ctx.fillStyle = style;
      for (const st of strokes) {
        // q: how much of the stroke is left, 1 (whole) to 0 (gone)
        const q = 1 - Math.max(0, Math.min(1, (p - st.begin) / STROKE_SHARE));
        if (q <= 0) continue;
        const k = q >= 1 ? st.n - 1 : easeOut(q) * (st.n - 1);
        if (k < 1) continue;
        ctx.globalAlpha = OPACITY * smooth(q / FADE_SHARE);
        fillStroke(ctx, st, k, grow * (q >= 1 ? 1 : BLOOM + (1 - BLOOM) * easeOut(q)));
      }
    }
    ctx.globalAlpha = 1;
  }
}
