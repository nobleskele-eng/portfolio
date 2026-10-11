// @ts-nocheck
/*
 * Turns a composition into draw ops: one group per landscape element, then the
 * objects, then every person frame. Pure and deterministic — used by the
 * worker (streamed) and by dev previews (all at once).
 */
import { clipAbove, flatBase } from "./clip.js";
import { Noise, capture, random, seed } from "./engine.js";
import { SPIN_FRAMES, bookshelfPavilion, loungeChair, noticeBoard, person, recordPlayer } from "./objects.js";
import { SEED, TALL, WIDE } from "./scenes.js";

export const POSES = ["wave", "sit", "sleep"];

/** Every frame a pose cycles through, keyed for the renderer's scheduler. */
export function poseFrames(pose) {
  if (pose === "wave") {
    const out = [];
    for (const arm of [-1, 0, 1, "rest"]) for (const breath of [0, 1]) out.push({ key: `a${arm}b${breath}`, arm, breath });
    return out;
  }
  if (pose === "sit") return [0, 1].map((breath) => ({ key: `b${breath}`, breath }));
  const out = [];
  for (const z of [0, 1, 2, 3]) for (const breath of [0, 1]) out.push({ key: `z${z}b${breath}`, z, breath });
  return out;
}

export function bboxOf(ops) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const eat = (a) => {
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

export function composition(layout) {
  return layout === "tall" ? TALL : WIDE;
}

/** Everything the renderer needs to know about a layout before its ops arrive. */
export function worldInfo(layout) {
  const c = composition(layout);
  return {
    w: c.w,
    h: c.h,
    minH: c.minH,
    planes: c.planes,
    focus: c.focus,
    lake: { poly: c.lake.poly, horizon: c.lake.horizon, bottom: c.lake.bottom },
    cloudTile: c.cloudTile,
  };
}

/**
 * Yields, in painter's order:
 *   { kind: "group", id, plane, t0, t1, ops,      per landscape element; an
 *     frames?, reflect? }                         animated one (the lake) also
 *                                                 carries every drawing, and
 *                                                 mountains standing in the
 *                                                 lake carry their waterline
 *   { kind: "object", id, t0, t1, ops, bbox }     shelf, board, chair
 *   { kind: "record", t0, t1, frames }            frames.stop, frames.spin0…
 *   { kind: "person", t0, t1, frames }            frames[pose][key] = ops
 */
export function* sceneParts(layout, seedStr = SEED) {
  const comp = composition(layout);
  const grounds = {};
  for (const el of comp.elements) {
    const reseed = () => seed(`${seedStr}/${el.id}`);
    if (el.frames) {
      const frames = [];
      for (let f = 0; f < el.frames; f++) {
        reseed();
        frames.push(capture(() => el.draw(grounds, reseed, f)));
      }
      yield { kind: "group", id: el.id, plane: el.plane, t0: el.t[0], t1: el.t[1], ops: frames[0], frames };
      continue;
    }
    reseed();
    let ops = capture(() => el.draw(grounds, reseed));
    // cut off at a line (the cliff's flat top, for the ledge to cap)
    if (el.clip) ops = clipAbove(ops, el.clip(grounds));
    if (el.flatBase) ops = flatBase(ops);
    yield { kind: "group", id: el.id, plane: el.plane, reflect: el.reflect, t0: el.t[0], t1: el.t[1], ops };
  }

  const place = comp.objects(grounds);
  const obj = (id, t, fn) => {
    seed(`${seedStr}/${id}`);
    const ops = capture(fn);
    return { kind: "object", id, t0: t[0], t1: t[1], ops, bbox: bboxOf(ops) };
  };
  const { shelf, board, lounge } = place;
  yield obj("shelf", shelf.t, () => bookshelfPavilion(shelf.at[0], shelf.at[1], shelf.s));
  yield obj("board", board.t, () => noticeBoard(board.at[0], board.at[1], board.s));

  const record = { stop: capture(() => recordPlayer(lounge.at[0], lounge.at[1], lounge.s, { playing: false })) };
  for (let i = 0; i < SPIN_FRAMES; i++) {
    record[`spin${i}`] = capture(() => recordPlayer(lounge.at[0], lounge.at[1], lounge.s, { playing: true, spin: i }));
  }
  yield { kind: "record", t0: lounge.t[0] - 0.4, t1: lounge.t[0] + 0.3, frames: record };

  const chairT = [lounge.t[0], lounge.t[0] + (lounge.t[1] - lounge.t[0]) * 0.55];
  yield obj("chair", chairT, () => loungeChair(lounge.at[0], lounge.at[1], lounge.s));

  const frames = {};
  for (const pose of POSES) {
    frames[pose] = {};
    for (const f of poseFrames(pose)) {
      frames[pose][f.key] = capture(() => person(pose, lounge.at[0], lounge.at[1], lounge.s, f));
    }
  }
  yield { kind: "person", t0: chairT[1] - 0.1, t1: lounge.t[1], frames };
}

/** Collects sceneParts into one object (dev previews, tests). */
export function buildScene(layout, seedStr) {
  const out = { layout, w: composition(layout).w, h: composition(layout).h, groups: [], objects: [], record: null, person: null };
  for (const part of sceneParts(layout, seedStr)) {
    if (part.kind === "group") out.groups.push(part);
    else if (part.kind === "object") out.objects.push(part);
    else if (part.kind === "record") out.record = part;
    else out.person = part;
  }
  return out;
}

/**
 * Upstream's paper texture: a 512px tile mirrored into quadrants so it repeats
 * seamlessly. Returns RGBA bytes.
 */
export function paperTile(seedStr = SEED, reso = 512) {
  seed(`${seedStr}/paper`);
  const px = new Uint8ClampedArray(reso * reso * 4);
  const put = (i, j, r, g, b) => {
    if (i < 0 || j < 0 || i >= reso || j >= reso) return;
    const o = (j * reso + i) * 4;
    px[o] = r;
    px[o + 1] = g;
    px[o + 2] = b;
    px[o + 3] = 255;
  };
  for (let i = 0; i < reso / 2 + 1; i++) {
    for (let j = 0; j < reso / 2 + 1; j++) {
      let c = 245 + Noise.noise(i * 0.1, j * 0.1) * 10;
      c -= random() * 20;
      const r = Math.round(c);
      const g = Math.round(c * 0.95);
      const b = Math.round(c * 0.85);
      put(i, j, r, g, b);
      put(reso - i, j, r, g, b);
      put(i, reso - j, r, g, b);
      put(reso - i, reso - j, r, g, b);
    }
  }
  return px;
}
