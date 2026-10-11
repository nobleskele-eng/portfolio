/*
 * Canvas renderer for the ink landscape.
 *
 * Intro: every op gets a start time and a duration inside its part's window.
 * Each part is painted from a few drops at once, the ink spreading out from
 * each along the op list, with every op's start thrown a little off the front
 * so marks spatter ahead of it. While an op runs it fades in as it draws: brush
 * strokes are revealed along their length (a growing prefix of both sides) and
 * swell to their full width, outlines grow by point count, fills bloom out from
 * their middle, and mist fades. Painter's order is kept by committing finished
 * ops to an offscreen bitmap only once no earlier op still running (or yet to
 * start) could overlap them; ops not yet committed are redrawn on top of it
 * every frame.
 *
 * As ops commit they're also baked into their depth plane's bitmap (sky,
 * clouds, far, mid, water, near). After the intro the screen is a composite of
 * those bitmaps under a camera: scrolling pushes the camera into the corner
 * vignette, each plane following it at its own rate so the distance recedes
 * (parallax), and the mouse nudges the planes apart a little. The lake is baked
 * into one bitmap per water drawing (a rippling reflection, its ripple strokes
 * and the boats) and cycled at 3fps; the clouds drift; the objects, record
 * player and person are drawn as vectors on top, so they stay crisp at any zoom.
 */
import {
  PLANES,
  type BBox,
  type FogOp,
  type GroupPart,
  type HotspotId,
  type ObjectPart,
  type Op,
  type PersonPart,
  type PlaneId,
  type Pose,
  type PolyOp,
  type RecordPart,
  type StrokeOp,
  type WorldInfo,
} from "@/lib/shanshui/types";

// The scene's timeline (the windows in scenes.js, and every duration below)
// plays this many times faster than written.
const PACE = 2;
// Ink speed (world units per second) and per-op duration bounds, in seconds.
const SPEED = 520;
const MIN_DUR = 0.15;
const MAX_DUR = 0.85;
const FILL_FADE = 0.25;
const WHITE_FADE = 0.35;
const FOG_FADE = 0.9;
// A part is painted from about one drop per this many ops, up to a limit.
const OPS_PER_DROP = 60;
const MAX_DROPS = 6;
// How far an op's start is thrown off the spreading front, as a share of its
// part's window: the spatter.
const SPATTER = 0.2;
// An op in flight reaches full strength this far through its duration, and
// starts at this share of its full width (strokes) or size (fills). A big
// fill's edge travels no further than a blot this size (world units) would,
// so large washes don't float in like cards.
const FADE_SHARE = 0.7;
const BLOOM = 0.7;
const BLOT = 14;
// Cells per side of the grid that tests whether two ops might overlap.
const GRID = 48;
// Redrawing more than this many in-flight ops per frame gets expensive on
// phones; the oldest are finished early instead.
const MAX_ACTIVE = 900;
// Re-inking the person after a pose change.
const REINK_S = 0.9;
// Hover darkens an object by drawing it again at this alpha.
const HOVER_ALPHA = 0.55;
// Hotspots are never smaller than this, in CSS px.
const MIN_HIT = 44;
// Longest step the intro clock takes per frame, in seconds.
const MAX_FRAME_S = 0.1;
// The lake cycles its drawings, and the clouds step along, at 3fps.
const WATER_STEP_MS = 1000 / 3;
// Record spin frames.
const SPIN_STEP_MS = 140;
// How far the clouds drift per step, in world units.
const CLOUD_DRIFT = 2.4;

// How strongly each plane follows the camera: 1 moves with it, 0 stays put.
const PARALLAX: Record<PlaneId, number> = { sky: 0.08, clouds: 0.14, far: 0.25, mid: 0.6, water: 0.6, near: 1 };
// The mouse shifts the nearest plane by up to this many CSS px.
const MOUSE_PX = 14;
// Plane bitmaps: no side longer than this, no denser than this many device px
// per world unit, and a total pixel budget across all of them.
const MAX_SIDE = 4096;
const MAX_RES = 3;
const PIXEL_BUDGET = 26e6;
// The lake's reflection: how faint, how far it reaches below each waterline
// (as a share of the water below it), and how much the ripples shear it
// (world units, far → near).
const REFLECT_ALPHA = 0.3;
const REFLECT_FADE = 0.34;
const REFLECT_WOBBLE: [number, number] = [0.5, 5];
// Without GPU canvas, compositing big bitmaps gets slow: after this many
// composites over the time limit, drop to lighter bitmaps.
const SLOW_FRAME_MS = 32;
const SLOW_FRAMES = 3;

/** A pre-rendered bitmap drawn as one op (the lake's reflection, in the intro). */
interface ImageOp {
  k: "i";
  canvas: HTMLCanvasElement;
  bbox: BBox;
}

interface Item {
  op: Op | ImageOp;
  fill: string | null;
  line: string | null;
  len: number;
  start: number;
  dur: number;
  /** the depth plane a landscape op is baked into */
  plane: PlaneId | null;
  /** set when scheduled: where the op lies (world units) */
  box: BBox | null;
  /** committed to the intro's bitmap */
  done: boolean;
}

interface Plane {
  id: PlaneId;
  bbox: BBox;
  /** device px per world unit */
  res: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  items: Item[];
}

interface View {
  s: number;
  ox: number;
  oy: number;
}

export interface Hotspot {
  id: HotspotId;
  x: number;
  y: number;
  w: number;
  h: number;
  /** where the seal label sits (its bottom-centre), relative to x/y */
  sx: number;
  sy: number;
}

function paint(c: string | undefined): string | null {
  if (!c || c === "none") return null;
  if (c.replace(/\s/g, "") === "rgba(0,0,0,0)") return null;
  return c;
}

function polyLength(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 2; i < a.length; i += 2) s += Math.hypot(a[i] - a[i - 2], a[i + 1] - a[i - 1]);
  return s;
}

function prepare(op: Op | ImageOp, plane: PlaneId | null): Item {
  const base = { op, start: 0, dur: 0, plane, box: null, done: false };
  if (op.k === "s") return { ...base, fill: op.col, line: op.out > 0 ? op.col : null, len: polyLength(op.l) };
  if (op.k === "p") return { ...base, fill: paint(op.fil), line: op.wid > 0 ? paint(op.str) : null, len: polyLength(op.pts) };
  return { ...base, fill: null, line: null, len: 80 };
}

/** Deterministic 0..1 noise per index. */
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Times a part's ops inside its window. Drops land along the op list (the
 * first on its first op, so the part's head is always under way); each op
 * starts as the ink spreading from the nearest drop reaches it, give or take
 * the spatter. The op list runs roughly through space, so the drops land in
 * different places. Mist settles from the start, so what it veils inks in
 * already softened beneath it.
 */
function schedule(items: Item[], t0: number, t1: number) {
  const n = items.length;
  if (!n) return;
  const span = Math.max(0.05, t1 - t0);
  const salt = n * 7.31 + t0 * 101.7;
  const drops = Math.max(1, Math.min(MAX_DROPS, Math.round(n / OPS_PER_DROP)));
  // the drops are this far apart, so none is more than half that from an op
  const gap = n / (drops - 0.5);
  const at: number[] = [0];
  for (let d = 1; d < drops; d++) at.push(d * gap + (hash(salt + d) - 0.5) * gap * 0.3);
  for (let i = 0; i < n; i++) {
    const it = items[i];
    const k = it.op.k;
    let dur =
      k === "f" || k === "i"
        ? FOG_FADE
        : k === "p" && it.fill
          ? it.fill === "white"
            ? WHITE_FADE
            : FILL_FADE
          : Math.min(MAX_DUR, Math.max(MIN_DUR, it.len / SPEED));
    dur = Math.min(dur, span);
    let near = Infinity;
    for (const a of at) near = Math.min(near, Math.abs(i - a));
    const front = Math.min(1, near / (gap / 2));
    const u = k === "f" ? 0 : Math.max(0, Math.min(1, front * (1 - SPATTER) + hash(salt + i * 1.618 + 9) * SPATTER));
    it.dur = dur;
    it.start = t0 + u * (span - dur);
    it.box = it.op.k === "i" ? it.op.bbox : boxOf([it.op]);
    it.done = false;
  }
}

/** A stroke up to p of its length, its sides pulled in to w of their width about the centreline. */
function traceStroke(ctx: CanvasRenderingContext2D, op: StrokeOp, p: number, w = 1) {
  const { l, r } = op;
  const n = l.length / 2;
  if (p >= 1 && w === 1) {
    ctx.moveTo(l[0], l[1]);
    for (let i = 1; i < n; i++) ctx.lineTo(l[2 * i], l[2 * i + 1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(r[2 * i], r[2 * i + 1]);
    ctx.closePath();
    return;
  }
  const h = (1 - w) / 2;
  const side = (a: ArrayLike<number>, b: ArrayLike<number>, i: number, t = 0) => {
    const j = Math.min(i + 1, n - 1);
    const ax = a[2 * i] + (a[2 * j] - a[2 * i]) * t;
    const ay = a[2 * i + 1] + (a[2 * j + 1] - a[2 * i + 1]) * t;
    const bx = b[2 * i] + (b[2 * j] - b[2 * i]) * t;
    const by = b[2 * i + 1] + (b[2 * j + 1] - b[2 * i + 1]) * t;
    ctx.lineTo(ax + (bx - ax) * h, ay + (by - ay) * h);
  };
  const f = Math.min(1, p) * (n - 1);
  const k = Math.floor(f);
  const t = f - k;
  ctx.moveTo(l[0] + (r[0] - l[0]) * h, l[1] + (r[1] - l[1]) * h);
  for (let i = 1; i <= k; i++) side(l, r, i);
  if (k < n - 1) {
    side(l, r, k, t);
    side(r, l, k, t);
  }
  for (let i = k; i >= 0; i--) side(r, l, i);
  ctx.closePath();
}

/** A polyline up to p of its points, scaled by s about (cx, cy). */
function tracePoly(ctx: CanvasRenderingContext2D, a: ArrayLike<number>, p: number, s = 1, cx = 0, cy = 0) {
  const n = a.length / 2;
  const to = (x: number, y: number) => ctx.lineTo(cx + (x - cx) * s, cy + (y - cy) * s);
  ctx.moveTo(cx + (a[0] - cx) * s, cy + (a[1] - cy) * s);
  if (p >= 1) {
    for (let i = 1; i < n; i++) to(a[2 * i], a[2 * i + 1]);
    return;
  }
  const f = p * (n - 1);
  const k = Math.floor(f);
  const t = f - k;
  for (let i = 1; i <= k; i++) to(a[2 * i], a[2 * i + 1]);
  if (k < n - 1) to(a[2 * k] + (a[2 * k + 2] - a[2 * k]) * t, a[2 * k + 1] + (a[2 * k + 3] - a[2 * k + 1]) * t);
}

function drawFog(ctx: CanvasRenderingContext2D, op: FogOp, alpha: number) {
  const g = ctx.createLinearGradient(0, op.y0, 0, op.y1);
  for (let i = 0; i < op.stops.length; i += 2) g.addColorStop(op.stops[i], `rgba(255,255,255,${op.stops[i + 1]})`);
  ctx.beginPath();
  tracePoly(ctx, op.pts, 1);
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fill();
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * Draws an op at progress p (0..1) with an overall alpha. Until p reaches 1
 * the op is inking in: it fades up while it draws, and swells to full size.
 */
function drawItem(ctx: CanvasRenderingContext2D, it: Item, p: number, alpha = 1) {
  if (p <= 0) return;
  const op = it.op;
  const live = p < 1;
  const a = live ? alpha * smooth(Math.min(1, p / FADE_SHARE)) : alpha;
  const reach = live ? easeOut(p) : 1;
  const grow = live ? BLOOM + (1 - BLOOM) * reach : 1;
  if (op.k === "i") {
    const b = op.bbox;
    ctx.globalAlpha = a;
    ctx.drawImage(op.canvas, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    return;
  }
  if (op.k === "f") {
    drawFog(ctx, op, a);
    return;
  }
  ctx.beginPath();
  if (op.k === "s") {
    traceStroke(ctx, op, reach, grow);
    ctx.globalAlpha = a;
    ctx.fillStyle = it.fill as string;
    ctx.fill();
    if (it.line) {
      ctx.lineWidth = op.out;
      ctx.strokeStyle = it.line;
      ctx.stroke();
    }
    return;
  }
  if (it.fill) {
    // a blot, spreading from its middle
    const b = it.box;
    if (live && b) {
      const size = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2;
      const s = 1 - (1 - grow) * Math.min(1, BLOT / Math.max(1, size));
      tracePoly(ctx, op.pts, 1, s, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    } else tracePoly(ctx, op.pts, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = it.fill;
    ctx.fill();
    if (it.line) {
      ctx.lineWidth = op.wid;
      ctx.strokeStyle = it.line;
      ctx.stroke();
    }
    return;
  }
  if (it.line) {
    tracePoly(ctx, (op as PolyOp).pts, reach);
    ctx.globalAlpha = a;
    ctx.lineWidth = op.wid;
    ctx.strokeStyle = it.line;
    ctx.stroke();
  }
}

function makeCanvas(w = 1, h = 1): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.lineJoin = "miter";
  ctx.miterLimit = 4;
  return ctx;
}

function unionBox(a: BBox | null, b: BBox): BBox {
  if (!a) return { ...b };
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

function boxOf(ops: Op[]): BBox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const eat = (a: ArrayLike<number>) => {
    for (let i = 0; i < a.length; i += 2) {
      if (a[i] < x0) x0 = a[i];
      if (a[i] > x1) x1 = a[i];
      if (a[i + 1] < y0) y0 = a[i + 1];
      if (a[i + 1] > y1) y1 = a[i + 1];
    }
  };
  for (const op of ops) {
    if (op.k === "s") {
      eat(op.l);
      eat(op.r);
    } else eat(op.pts);
  }
  return { x0, y0, x1, y1 };
}

/** Which person frame shows at `ms` into the idle loop (stepped, no tweening). */
export function frameKey(pose: Pose, ms: number, still: boolean): string {
  if (pose === "wave") {
    if (still) return "a0b0";
    const breath = Math.floor(ms / 800) % 2;
    const ph = ms % 4600;
    const arm = ph < 1700 ? [0, 1, 0, -1][Math.floor(ph / 170) % 4] : "rest";
    return `a${arm}b${breath}`;
  }
  if (pose === "sit") return still ? "b0" : `b${Math.floor(ms / 900) % 2}`;
  if (still) return "z2b0";
  return `z${Math.floor(ms / 650) % 4}b${Math.floor(ms / 1300) % 2}`;
}

/** The record player's frame: spinning only while music plays. */
export function recordKey(playing: boolean, ms: number, frames: number, still: boolean): string {
  if (!playing) return "stop";
  return `spin${still ? 0 : Math.floor(ms / SPIN_STEP_MS) % frames}`;
}

export class InkRenderer {
  private ctx: CanvasRenderingContext2D;
  private commit = makeCanvas();
  private commitCtx = context(this.commit);

  private world: WorldInfo | null = null;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private safeH = 0;
  /** the camera is gliding: composite with cheaper filtering until it settles */
  private moving = false;
  /** camera at the top of the scroll, and fully zoomed into the vignette */
  private base: View = { s: 1, ox: 0, oy: 0 };
  private end: View = { s: 1, ox: 0, oy: 0 };
  private zoom = 0;
  private mouse = { x: 0, y: 0 };

  private planes = new Map<PlaneId, Plane>();
  private waterFrames: Item[][] = [];
  private waterStatic: Item[] = [];
  /** baked lake drawings; [0] first, the rest a task at a time after it */
  private waterBitmaps: (HTMLCanvasElement | undefined)[] = [];
  private reflection: HTMLCanvasElement | null = null;
  private bakeTimer = 0;
  private slowFrames = 0;
  private lowPower = false;
  private mirrors: { items: Item[]; base: number }[] = [];

  /** Everything in painter's order, for the intro. */
  private items: Item[] = [];
  private objects = new Map<string, { items: Item[]; bbox: BBox }>();
  private record: { frames: Record<string, Item[]>; count: number; bbox: BBox } | null = null;
  private person: PersonPart | null = null;
  private personItems: Record<string, Item[]> = {};
  /** first op not yet committed; some after it may already be */
  private committed = 0;
  /** grid over the world: cells under an op that's holding later ones back */
  private blocks = new Uint8Array(GRID * GRID);
  private grid = { x0: 0, y0: 0, cw: 1, ch: 1 };
  private personIntroAt = -1;
  private skipped = false;

  private clock = 0;
  private lastTick = 0;
  private started = false;
  private introDone = false;

  pose: Pose = "sit";
  playing = false;
  private shownKey = "";
  private reinkAt = -1;
  private hover: HotspotId | null = null;
  private still = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = context(canvas);
  }

  /* ---------------------------------------------------------------- setup */

  setWorld(world: WorldInfo) {
    this.world = world;
    let b: BBox = { x0: 0, y0: 0, x1: world.w, y1: world.h };
    for (const id of PLANES) b = unionBox(b, world.planes[id]);
    this.grid = { x0: b.x0, y0: b.y0, cw: (b.x1 - b.x0) / GRID, ch: (b.y1 - b.y0) / GRID };
    this.layout();
  }

  setStill(still: boolean) {
    this.still = still;
  }

  get ready() {
    return this.introDone;
  }

  /** Seconds into the intro: 0 until it starts, Infinity once it's done or skipped. */
  get introTime() {
    if (this.introDone || this.skipped) return Infinity;
    return this.started ? this.clock : 0;
  }

  /**
   * The canvas is cssW × cssH; the scene is fitted into its top safeH, the
   * part a phone always shows. Below that is only seen while the browser's
   * bars are slid away, so the layout doesn't shift when they come and go.
   */
  resize(cssW: number, cssH: number, dpr: number, safeH = cssH) {
    safeH = Math.min(cssH, safeH || cssH);
    if (cssW === this.cssW && cssH === this.cssH && safeH === this.safeH && Math.min(2, dpr || 1) === this.dpr) return;
    this.cssW = cssW;
    this.cssH = cssH;
    this.safeH = safeH;
    this.dpr = Math.min(2, dpr || 1);
    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    this.ctx = context(this.canvas);
    if (!this.introDone) {
      this.commit.width = this.canvas.width;
      this.commit.height = this.canvas.height;
      this.commitCtx = context(this.commit);
    }
    this.layout();
    // the bitmaps were sized afresh: rebuild them from the ops
    if (this.started && !this.introDone) this.finish();
    else if (this.introDone) {
      this.rebuildPlanes();
      this.render(performance.now());
    }
  }

  /** Cameras, plane bitmaps and the intro transform for the current size. */
  private layout() {
    const w = this.world;
    if (!w || !this.cssW) return;
    const h = this.safeH;
    // top of the scroll: contain-fit, anchored bottom-left; sky above minH may
    // crop, and a screen wider than the scene shows more of it to the right
    const s0 = Math.min(this.cssW / w.w, h / w.minH);
    this.base = { s: s0, ox: 0, oy: h - w.h * s0 };
    // bottom of the scroll: the vignette fills the screen, still covering the
    // bottom-left edges so no bare paper shows there
    const f = w.focus;
    const s1 = Math.max(s0, Math.min(this.cssW / (f.x1 - f.x0), h / (f.y1 - f.y0)) * 0.94);
    const ox = Math.min(0, this.cssW / 2 - ((f.x0 + f.x1) / 2) * s1);
    const oy = Math.max(h - w.h * s1, h / 2 - ((f.y0 + f.y1) / 2) * s1);
    this.end = { s: s1, ox, oy };

    // each plane is drawn dense enough to stay crisp at full zoom, within budget
    const mag = s1 / s0;
    const want: [PlaneId, number][] = PLANES.map((id) => {
      const extra = id === "water" ? 1 : Math.pow(mag, PARALLAX[id]);
      return [id, Math.min(MAX_RES, s0 * this.dpr * extra)];
    });
    let pixels = 0;
    for (const [id, res] of want) {
      const b = w.planes[id];
      pixels += (b.x1 - b.x0) * res * (b.y1 - b.y0) * res;
    }
    const limit = this.lowPower ? PIXEL_BUDGET / 6 : PIXEL_BUDGET;
    const budget = Math.min(1, Math.sqrt(limit / Math.max(1, pixels)));
    for (const [id, res0] of want) {
      const b = w.planes[id];
      const res = Math.min(res0 * budget, MAX_SIDE / (b.x1 - b.x0), MAX_SIDE / (b.y1 - b.y0));
      const prev = this.planes.get(id);
      const canvas = prev?.canvas ?? makeCanvas();
      canvas.width = Math.max(1, Math.round((b.x1 - b.x0) * res));
      canvas.height = Math.max(1, Math.round((b.y1 - b.y0) * res));
      this.planes.set(id, { id, bbox: b, res, canvas, ctx: context(canvas), items: prev?.items ?? [] });
    }
    this.resetWater();
    this.setIntroTransform(this.commitCtx);
  }

  private setIntroTransform(ctx: CanvasRenderingContext2D) {
    const v = this.base;
    ctx.setTransform(v.s * this.dpr, 0, 0, v.s * this.dpr, v.ox * this.dpr, v.oy * this.dpr);
  }

  private planeTransform(p: Plane, ctx = p.ctx) {
    ctx.setTransform(p.res, 0, 0, p.res, -p.bbox.x0 * p.res, -p.bbox.y0 * p.res);
  }

  /* ---------------------------------------------------------------- parts */

  /** Adds a streamed part. The intro clock starts with the first one. */
  addGroup(part: GroupPart, now: number) {
    if (!this.started) this.start(now);
    const items = part.ops.map((op) => prepare(op, part.plane));
    const intro = items.slice();
    if (part.frames) {
      this.waterFrames = [items, ...part.frames.slice(1).map((ops) => ops.map((op) => prepare(op, part.plane)))];
      // the reflection fades in with the lake
      const refl = this.reflectionIntro();
      if (refl) intro.unshift(refl);
    } else if (part.plane === "water") {
      this.waterStatic.push(...items);
    } else {
      this.planes.get(part.plane)?.items.push(...items);
    }
    if (part.reflect !== undefined) this.mirrors.push({ items, base: part.reflect });
    const shift = Math.max(0, this.clock - part.t0);
    schedule(intro, part.t0 + shift, part.t1 + shift);
    this.items.push(...intro);
    if (this.introDone || this.skipped) this.finish();
  }

  addObject(part: ObjectPart, now: number) {
    if (!this.started) this.start(now);
    const items = part.ops.map((op) => prepare(op, null));
    const shift = Math.max(0, this.clock - part.t0);
    schedule(items, part.t0 + shift, part.t1 + shift);
    this.items.push(...items);
    this.objects.set(part.id, { items, bbox: part.bbox });
    if (this.introDone || this.skipped) this.finish();
  }

  /**
   * The record player paints in with its arm up; if music is playing, the
   * needle drops once the painting is done.
   */
  setRecord(part: RecordPart, now: number) {
    if (!this.started) this.start(now);
    const frames: Record<string, Item[]> = {};
    let bbox: BBox | null = null;
    for (const key of Object.keys(part.frames)) {
      frames[key] = part.frames[key].map((op) => prepare(op, null));
      bbox = unionBox(bbox, boxOf(part.frames[key]));
    }
    const count = Object.keys(frames).filter((k) => k.startsWith("spin")).length;
    this.record = { frames, count, bbox: bbox as BBox };
    const intro = frames.stop;
    const shift = Math.max(0, this.clock - part.t0);
    schedule(intro, part.t0 + shift, part.t1 + shift);
    this.items.push(...intro);
    if (this.introDone || this.skipped) this.finish();
  }

  setPerson(part: PersonPart, now: number) {
    if (!this.started) this.start(now);
    this.person = part;
    this.personItems = {};
    for (const pose of Object.keys(part.frames) as Pose[]) {
      for (const key of Object.keys(part.frames[pose])) {
        this.personItems[`${pose}:${key}`] = part.frames[pose][key].map((op) => prepare(op, null));
      }
    }
    this.queuePersonIntro();
    if (this.introDone || this.skipped) this.finish();
  }

  /** Appends the person's intro frame (always the last thing drawn). */
  private queuePersonIntro() {
    const part = this.person as PersonPart;
    const intro = this.personItems[`${this.pose}:${frameKey(this.pose, 0, true)}`];
    const shift = Math.max(0, this.clock - part.t0);
    schedule(intro, part.t0 + shift, part.t1 + shift);
    this.personIntroAt = this.items.length;
    this.items.push(...intro);
  }

  private start(now: number) {
    this.started = true;
    this.lastTick = now;
  }

  /**
   * The intro clock (scene seconds) advances by capped frame deltas rather
   * than wall time, so a tab opened in the background (no frames) starts its
   * intro when it's actually seen, and pauses if hidden halfway.
   */
  private advanceClock(now: number) {
    this.clock += Math.min(MAX_FRAME_S, Math.max(0, (now - this.lastTick) / 1000)) * PACE;
    this.lastTick = now;
  }

  /* ---------------------------------------------------------------- lake */

  /** The mountains standing in the lake, mirrored about their waterlines. */
  private buildReflection(): HTMLCanvasElement | null {
    const water = this.planes.get("water");
    const w = this.world;
    if (!water || !w || !this.mirrors.length) return null;
    const out = makeCanvas(water.canvas.width, water.canvas.height);
    const octx = context(out);
    const tmp = makeCanvas(out.width, out.height);
    const tctx = context(tmp);
    const { x0, y0, x1 } = water.bbox;
    const r = water.res;
    for (const m of this.mirrors) {
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.globalCompositeOperation = "source-over";
      tctx.clearRect(0, 0, tmp.width, tmp.height);
      // y' = 2·base − y
      tctx.setTransform(r, 0, 0, -r, -x0 * r, (2 * m.base - y0) * r);
      for (const it of m.items) drawItem(tctx, it, 1);
      // fade with distance below the waterline
      tctx.setTransform(r, 0, 0, r, -x0 * r, -y0 * r);
      const reach = (w.lake.bottom - m.base) * REFLECT_FADE + 60;
      const g = tctx.createLinearGradient(0, m.base, 0, m.base + reach);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      tctx.globalAlpha = 1;
      tctx.globalCompositeOperation = "destination-in";
      tctx.fillStyle = g;
      tctx.fillRect(x0, y0, x1 - x0, water.bbox.y1 - y0);
      tctx.globalCompositeOperation = "source-over";
      octx.drawImage(tmp, 0, 0);
    }
    return out;
  }

  /** The reflection sheared into rippled strips and clipped to the lake. */
  private drawReflection(ctx: CanvasRenderingContext2D, water: Plane, refl: HTMLCanvasElement, frame: number) {
    const w = this.world as WorldInfo;
    ctx.save();
    this.planeTransform(water, ctx);
    ctx.beginPath();
    tracePoly(ctx, w.lake.poly, 1);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = REFLECT_ALPHA;
    const r = water.res;
    const strip = 2;
    const phase = (frame / 3) * Math.PI * 2;
    const { horizon, bottom } = w.lake;
    for (let py = 0; py < refl.height; py += strip) {
      const y = water.bbox.y0 + py / r;
      const d = Math.max(0, Math.min(1, (y - horizon) / (bottom - horizon)));
      // broken streaks: some rows of the reflection drop out
      if (Math.sin(y * 0.9 + Math.sin(y * 0.13) * 4) > 0.82 - 0.2 * d) continue;
      const amp = (REFLECT_WOBBLE[0] + (REFLECT_WOBBLE[1] - REFLECT_WOBBLE[0]) * d) * r;
      const dx = Math.sin(y * 0.16 + phase) * amp + Math.sin(y * 0.047 - phase) * amp * 0.5;
      ctx.drawImage(refl, 0, py, refl.width, strip, dx, py, refl.width, strip);
    }
    ctx.restore();
  }

  /** The first reflection drawing as one image op, to fade in during the intro. */
  private reflectionIntro(): Item | null {
    const water = this.planes.get("water");
    const refl = this.buildReflection();
    if (!water || !refl) return null;
    const canvas = makeCanvas(water.canvas.width, water.canvas.height);
    this.drawReflection(context(canvas), water, refl, 0);
    return prepare({ k: "i", canvas, bbox: water.bbox }, null);
  }

  /**
   * One bitmap per water drawing: reflection, that drawing's ripples, boats.
   * Drawing 0 is baked on demand; the rest follow a task at a time, so the end
   * of the intro doesn't stall (the lake holds still until they're ready).
   */
  private bakeWater(f: number) {
    const water = this.planes.get("water");
    if (!water || !this.waterFrames[f]) return;
    if (!this.reflection) this.reflection = this.buildReflection();
    const c = makeCanvas(water.canvas.width, water.canvas.height);
    const ctx = context(c);
    if (this.reflection) this.drawReflection(ctx, water, this.reflection, f);
    this.planeTransform(water, ctx);
    for (const it of this.waterFrames[f]) drawItem(ctx, it, 1);
    for (const it of this.waterStatic) drawItem(ctx, it, 1);
    ctx.globalAlpha = 1;
    this.waterBitmaps[f] = c;
    const next = this.waterBitmaps.findIndex((b, i) => !b && i < this.waterFrames.length);
    const missing = next >= 0 ? next : this.waterBitmaps.length < this.waterFrames.length ? this.waterBitmaps.length : -1;
    if (missing >= 0) {
      this.bakeTimer = window.setTimeout(() => this.bakeWater(missing), 30);
    } else {
      this.reflection = null; // every drawing has it baked in now
    }
  }

  private resetWater() {
    clearTimeout(this.bakeTimer);
    this.waterBitmaps = [];
    this.reflection = null;
  }

  /* ------------------------------------------------------------- camera */

  /**
   * Scroll progress (0 = whole scene, 1 = the vignette) and mouse (−1..1).
   * While `moving`, frames are composited with cheaper filtering; the frame
   * that settles is drawn at full quality.
   */
  setView(zoom: number, mx: number, my: number, now: number, moving = false) {
    this.zoom = Math.max(0, Math.min(1, zoom));
    this.mouse = { x: mx, y: my };
    this.moving = moving;
    if (this.introDone) this.render(now);
  }

  /** The camera for the current scroll position: the view rect eases between base and end. */
  private camera(): View {
    const e = smooth(this.zoom);
    if (e <= 0) return this.base;
    const rect = (v: View) => ({ x: -v.ox / v.s, y: -v.oy / v.s, w: this.cssW / v.s });
    const a = rect(this.base);
    const b = rect(this.end);
    const x = a.x + (b.x - a.x) * e;
    const y = a.y + (b.y - a.y) * e;
    const wv = a.w + (b.w - a.w) * e;
    const s = this.cssW / wv;
    return { s, ox: -x * s, oy: -y * s };
  }

  /** A plane's transform: scale blended toward the camera's by its parallax, anchored on the vignette. */
  private view(id: PlaneId | "objects", cam = this.camera()): View {
    const w = this.world as WorldInfo;
    const k = this.still || id === "objects" ? 1 : PARALLAX[id];
    const fx = (w.focus.x0 + w.focus.x1) / 2;
    const fy = (w.focus.y0 + w.focus.y1) / 2;
    const ax = fx * cam.s + cam.ox;
    const ay = fy * cam.s + cam.oy;
    const s = this.base.s * Math.pow(cam.s / this.base.s, k);
    const m = this.still ? 0 : MOUSE_PX * (id === "objects" ? 1 : PARALLAX[id]);
    return { s, ox: ax - fx * s - this.mouse.x * m, oy: ay - fy * s - this.mouse.y * m };
  }

  /** CSS transform that keeps the hotspot overlay glued to the objects. */
  overlay(): { z: number; tx: number; ty: number } {
    if (!this.world) return { z: 1, tx: 0, ty: 0 };
    const v = this.view("objects");
    const z = v.s / this.base.s;
    return { z, tx: v.ox - this.base.ox * z, ty: v.oy - this.base.oy * z };
  }

  /* ------------------------------------------------------------ hotspots */

  /** Hotspots in CSS px at the top-of-scroll camera; overlay() moves them. */
  hotspots(): Hotspot[] {
    const out: Hotspot[] = [];
    const { s, ox, oy } = this.base;
    // the seal sits above `label` (the drawing itself), centred
    const toCss = (id: HotspotId, b: BBox, label: BBox = b) => {
      let x = b.x0 * s + ox;
      let y = b.y0 * s + oy;
      let w = (b.x1 - b.x0) * s;
      let h = (b.y1 - b.y0) * s;
      if (w < MIN_HIT) {
        x -= (MIN_HIT - w) / 2;
        w = MIN_HIT;
      }
      if (h < MIN_HIT) {
        y -= (MIN_HIT - h) / 2;
        h = MIN_HIT;
      }
      const sx = ((label.x0 + label.x1) / 2) * s + ox - x;
      const sy = label.y0 * s + oy - y;
      out.push({ id, x, y, w, h, sx, sy });
    };
    const shelf = this.objects.get("shelf");
    const board = this.objects.get("board");
    const person = this.personBox();
    // the person's seal goes over their head, not over the chair as well
    if (person) toCss("person", person, this.personBox(false) as BBox);
    if (board) toCss("board", board.bbox);
    if (shelf) toCss("shelf", shelf.bbox);
    // last, so the small record player wins where its padding overlaps the chair
    if (this.record) toCss("record", this.record.bbox);
    return out;
  }

  private personBox(withChair = true): BBox | null {
    if (!this.person) return null;
    let box: BBox | null = withChair ? (this.objects.get("chair")?.bbox ?? null) : null;
    for (const key of Object.keys(this.person.frames[this.pose])) {
      box = unionBox(box, boxOf(this.person.frames[this.pose][key]));
    }
    return box;
  }

  /* ------------------------------------------------------------- control */

  setHover(id: HotspotId | null, now: number) {
    if (id === this.hover) return;
    this.hover = id;
    if (this.introDone) this.render(now);
  }

  /** Switches pose; after the intro the new pose is re-inked. */
  setPose(pose: Pose, now: number) {
    if (pose === this.pose) return;
    this.pose = pose;
    if (!this.introDone) {
      // Still drawing: if the person hasn't started inking yet, swap the
      // queued frame so they appear in the right pose from the start.
      const at = this.personIntroAt;
      let waiting = at >= 0 && at < this.items.length;
      for (let i = at; waiting && i < this.items.length; i++) waiting = this.items[i].start > this.clock;
      if (waiting) {
        this.items.length = at;
        this.queuePersonIntro();
      }
      return;
    }
    this.reinkAt = now;
    const items = this.personItems[`${pose}:${frameKey(pose, 0, true)}`];
    if (items) schedule(items, 0, REINK_S);
  }

  /** Spotify playing or not; the record spins only while it is. */
  setPlaying(playing: boolean, now: number) {
    if (playing === this.playing) return;
    this.playing = playing;
    if (this.introDone) this.render(now);
  }

  /** Jumps the intro to its last frame; parts that arrive later draw instantly. */
  skip(now: number) {
    this.skipped = true;
    if (!this.started || this.introDone) return;
    this.finish();
    this.render(now);
  }

  /**
   * Advances the intro (or a re-ink) and redraws. Returns true while a
   * continuous animation is running.
   */
  tick(now: number): boolean {
    if (!this.started) return false;
    if (!this.introDone) {
      this.advanceClock(now);
      this.advanceIntro(this.clock);
      return true;
    }
    this.render(now);
    return this.reinkAt >= 0;
  }

  /* ------------------------------------------------------------ internals */

  private clear(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  private commitItem(it: Item) {
    it.done = true;
    drawItem(this.commitCtx, it, 1);
    if (it.plane && it.plane !== "water") {
      const p = this.planes.get(it.plane);
      if (p) {
        this.planeTransform(p);
        drawItem(p.ctx, it, 1);
      }
    }
  }

  /**
   * Marks the grid cells under a box as held, or (mark false) reports whether
   * any of them already is. Coarse, so it only ever errs towards "might overlap".
   */
  private cells(b: BBox, mark: boolean): boolean {
    const g = this.grid;
    const col = (x: number) => Math.max(0, Math.min(GRID - 1, Math.floor((x - g.x0) / g.cw)));
    const row = (y: number) => Math.max(0, Math.min(GRID - 1, Math.floor((y - g.y0) / g.ch)));
    const c0 = col(b.x0);
    const c1 = col(b.x1);
    const r1 = row(b.y1);
    for (let r = row(b.y0); r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (mark) this.blocks[r * GRID + c] = 1;
        else if (this.blocks[r * GRID + c]) return true;
      }
    }
    return false;
  }

  private advanceIntro(t: number) {
    const items = this.items;
    // ops after the last one started can't have finished, or hold anything back
    let end = items.length;
    while (end > this.committed && items[end - 1].start > t) end--;
    // Commit each finished op unless an earlier one, still running or yet to
    // start, might overlap it: order only matters where ops touch.
    this.blocks.fill(0);
    let active = 0;
    for (let i = this.committed; i < end; i++) {
      const it = items[i];
      if (it.done) continue;
      const box = it.box as BBox;
      if (it.start + it.dur <= t && !this.cells(box, false)) {
        this.commitItem(it);
        continue;
      }
      this.cells(box, true);
      if (it.start <= t) active++;
    }
    // bound the per-frame redraw: finish the oldest early, in order
    for (let i = this.committed; active > MAX_ACTIVE && i < items.length; i++) {
      const it = items[i];
      if (it.done) continue;
      if (it.start <= t) active--;
      this.commitItem(it);
    }
    while (this.committed < items.length && items[this.committed].done) this.committed++;

    const ctx = this.ctx;
    this.clear(ctx);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.commit, 0, 0);
    ctx.restore();
    this.setIntroTransform(ctx);
    for (let i = this.committed; i < end; i++) {
      const it = items[i];
      if (it.done || it.start > t) continue;
      drawItem(ctx, it, (t - it.start) / it.dur);
    }
    ctx.globalAlpha = 1;

    if (this.committed >= items.length && this.person) {
      this.introDone = true;
      this.releaseCommit();
      this.render(performance.now());
    }
  }

  /** The intro's bitmap and op list (incl. the reflection fade) aren't needed once it's done. */
  private releaseCommit() {
    this.commit.width = 1;
    this.commit.height = 1;
    this.items = [];
    this.personIntroAt = -1;
  }

  /** Commits everything left and switches to the composite. */
  private finish() {
    this.clear(this.commitCtx);
    this.setIntroTransform(this.commitCtx);
    for (const it of this.items) drawItem(this.commitCtx, it, 1);
    this.commitCtx.globalAlpha = 1;
    this.rebuildPlanes();
    this.committed = this.items.length;
    if (this.person) {
      this.introDone = true;
      this.releaseCommit();
    }
  }

  private rebuildPlanes() {
    this.planes.forEach((p) => {
      this.clear(p.ctx);
      this.planeTransform(p);
      for (const it of p.items) drawItem(p.ctx, it, 1);
      p.ctx.globalAlpha = 1;
    });
    this.resetWater();
  }

  private waterIndex(now: number) {
    if (this.still || !this.waterFrames.length) return 0;
    const f = Math.floor(now / WATER_STEP_MS) % this.waterFrames.length;
    return this.waterBitmaps[f] ? f : 0;
  }

  private cloudStep(now: number) {
    return this.still ? 0 : Math.floor(now / WATER_STEP_MS);
  }

  /** Composite key of everything that animates on its own clock. */
  private idleKey(now: number) {
    const record = this.record ? recordKey(this.playing, now, this.record.count, this.still) : "";
    return `${this.pose}:${frameKey(this.pose, now, this.still)}|w${this.waterIndex(now)}|c${this.cloudStep(now)}|${record}`;
  }

  private drawPlane(p: Plane, bitmap: HTMLCanvasElement, cam: View, dx = 0) {
    const v = this.view(p.id, cam);
    const d = this.dpr;
    this.ctx.setTransform(v.s * d, 0, 0, v.s * d, v.ox * d, v.oy * d);
    const b = p.bbox;
    this.ctx.drawImage(bitmap, b.x0 + dx, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }

  /**
   * The composite: each plane's bitmap under its own transform (the lake's
   * current drawing in place of the water plane, the clouds tiled and
   * drifting), then the objects (+hover), record player and person as vectors.
   */
  render(now: number) {
    const w = this.world;
    if (!this.introDone || !w) return;
    if (!this.waterBitmaps[0]) this.bakeWater(0);
    const t0 = performance.now();
    const ctx = this.ctx;
    this.clear(ctx);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = this.moving ? "medium" : "high";
    ctx.globalAlpha = 1;
    const cam = this.camera();

    for (const id of PLANES) {
      const p = this.planes.get(id);
      if (!p) continue;
      if (id === "water") {
        const bmp = this.waterBitmaps[this.waterIndex(now)];
        if (bmp) this.drawPlane(p, bmp, cam);
      } else if (id === "clouds") {
        const shift = (this.cloudStep(now) * CLOUD_DRIFT) % w.cloudTile;
        this.drawPlane(p, p.canvas, cam, shift);
        this.drawPlane(p, p.canvas, cam, shift - w.cloudTile);
      } else {
        this.drawPlane(p, p.canvas, cam);
      }
    }

    const v = this.view("objects", cam);
    const d = this.dpr;
    ctx.setTransform(v.s * d, 0, 0, v.s * d, v.ox * d, v.oy * d);
    const drawAll = (items: Item[], alpha = 1) => {
      for (const it of items) drawItem(ctx, it, 1, alpha);
    };
    const shelf = this.objects.get("shelf");
    const board = this.objects.get("board");
    const chair = this.objects.get("chair");
    if (shelf) {
      drawAll(shelf.items);
      if (this.hover === "shelf") drawAll(shelf.items, HOVER_ALPHA);
    }
    if (board) {
      drawAll(board.items);
      if (this.hover === "board") drawAll(board.items, HOVER_ALPHA);
    }
    if (this.record) {
      const items = this.record.frames[recordKey(this.playing, now, this.record.count, this.still)] || [];
      drawAll(items);
      if (this.hover === "record") drawAll(items, HOVER_ALPHA);
    }
    if (chair) {
      drawAll(chair.items);
      if (this.hover === "person") drawAll(chair.items, HOVER_ALPHA);
    }
    if (this.person) {
      if (this.reinkAt >= 0) {
        const t = (now - this.reinkAt) / 1000;
        const items = this.personItems[`${this.pose}:${frameKey(this.pose, 0, true)}`] || [];
        for (const it of items) drawItem(ctx, it, (t - it.start) / it.dur);
        if (t >= REINK_S) this.reinkAt = -1;
      } else {
        const items = this.personItems[`${this.pose}:${frameKey(this.pose, now, this.still)}`] || [];
        drawAll(items);
        if (this.hover === "person") drawAll(items, HOVER_ALPHA);
      }
    }
    ctx.globalAlpha = 1;
    this.shownKey = this.idleKey(now);
    this.watchSpeed(performance.now() - t0);
  }

  /** Falls back to lighter plane bitmaps if compositing keeps running slow. */
  private watchSpeed(ms: number) {
    if (this.lowPower) return;
    this.slowFrames = ms > SLOW_FRAME_MS ? this.slowFrames + 1 : 0;
    if (this.slowFrames < SLOW_FRAMES) return;
    this.lowPower = true;
    this.layout();
    this.rebuildPlanes();
  }

  /** True when anything animated (person, lake, clouds, record) is due a new frame. */
  frameDue(now: number): boolean {
    if (!this.introDone || !this.person) return false;
    return this.idleKey(now) !== this.shownKey;
  }
}
