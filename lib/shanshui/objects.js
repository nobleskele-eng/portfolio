// @ts-nocheck
/*
 * The clickable things in the scene, drawn with the engine's own brush
 * primitives so they match the landscape: a lounge chair + the person in three
 * poses, a record player on a side table, a roofed notice board, and a
 * bookshelf pavilion. Also the lake's animated water.
 *
 * Everything faces right (towards the landscape) and is positioned by a ground
 * anchor (x, y) plus a scale. Each builder returns an upstream-style token
 * string; wrap it in capture() to get ops.
 */
import { Arch, Man, Noise, blob, div, emitOp, poly, random, seed, stroke } from "./engine.js";

const ink = (a) => "rgba(100,100,100," + a + ")";
const flat = () => 1;

/** A wobbly brush line between points, in the style of Arch's box edges. */
function line(pts, { wid = 1.5, col = ink(0.5), seg = 6, noi = 1 } = {}) {
  return stroke(div(pts, seg), { wid, col, noi, fun: flat });
}

const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

// Same joint tree as Man.man: 0 hips → 1 neck → 2 head-top, 1 → 5 → 6 (near
// arm), 1 → 7 → 8 (far arm), 0 → 3 knee → 4 foot.
const PARENT = [-1, 0, 1, 0, 3, 1, 5, 1, 7];
const BASE_LEN = [0, 30, 20, 30, 30, 30, 30, 30, 30];

/** Joint positions (relative to the hips) for absolute-angle `abs` and `len`. */
function joints(abs, len) {
  const pts = [[0, 0]];
  for (let i = 1; i < 9; i++) {
    const p = pts[PARENT[i]];
    pts[i] = [p[0] + len[i] * Math.cos(abs[i]), p[1] + len[i] * Math.sin(abs[i])];
  }
  return pts;
}

/** Man.man wants angles relative to the parent joint. */
function relative(abs) {
  return abs.map((a, i) => (i === 0 ? a : a - (PARENT[i] === 0 ? abs[0] : abs[PARENT[i]])));
}

/* -------------------------------------------------------------------------- */
/* Lounge chair                                                               */
/* -------------------------------------------------------------------------- */

// Bamboo recliner, local units (y up is negative), origin = rear foot on the
// ground. The person's skeleton is fitted to these points.
const CHAIR = {
  seatBack: [0, -20],
  seatFront: [32, -24],
  footEnd: [58, -11],
  backTop: [-24, -54],
  armBack: [-10, -37],
  armFront: [30, -36],
  depth: [7, -4],
};

function chairGeometry(x, y, s) {
  const P = {};
  for (const k of Object.keys(CHAIR)) P[k] = [x + CHAIR[k][0] * s, y + CHAIR[k][1] * s];
  P.depth = [CHAIR.depth[0] * s, CHAIR.depth[1] * s];
  return P;
}

export function loungeChair(x, y, s) {
  const P = chairGeometry(x, y, s);
  const D = P.depth;
  const far = (p) => add(p, D);
  const rail = [P.backTop, P.seatBack, P.seatFront, P.footEnd];
  let canv = "";

  // far side first (lighter), then the woven surface, then the near side
  canv += line(rail.map(far), { wid: 1.2 * s, col: ink(0.35) });
  canv += line([far(P.seatBack), [far(P.seatBack)[0] + 1 * s, y + D[1] * 0.6]], { wid: 1.2 * s, col: ink(0.35) });
  canv += line([far(P.seatFront), [far(P.seatFront)[0] - 1 * s, y + D[1] * 0.6]], { wid: 1.2 * s, col: ink(0.35) });

  canv += poly(rail.concat(rail.slice().reverse().map(far)), { fil: "white", str: "none" });

  // bamboo slats across the surface
  for (let i = 0; i < rail.length - 1; i++) {
    const n = Math.max(2, Math.round(Math.hypot(rail[i + 1][0] - rail[i][0], rail[i + 1][1] - rail[i][1]) / (4.5 * s)));
    for (let j = 1; j < n; j++) {
      const p = lerp(rail[i], rail[i + 1], j / n);
      canv += line([p, far(p)], { wid: 0.9 * s, col: ink(0.3), seg: 2 });
    }
  }

  canv += line(rail, { wid: 1.8 * s, col: ink(0.55) });
  // legs
  canv += line([P.seatBack, [P.seatBack[0] + 1.5 * s, y]], { wid: 1.6 * s });
  canv += line([P.seatFront, [P.seatFront[0] - 1.5 * s, y]], { wid: 1.6 * s });
  canv += line([P.footEnd, [P.footEnd[0] + 1 * s, y]], { wid: 1.4 * s });
  // armrest + its front post
  canv += line([P.armBack, P.armFront], { wid: 1.5 * s });
  canv += line([P.armFront, lerp(P.seatFront, P.seatBack, 0.08)], { wid: 1.3 * s });
  return canv;
}

/* -------------------------------------------------------------------------- */
/* Person                                                                     */
/* -------------------------------------------------------------------------- */

export const PERSON_SEED = "person";

const HALF_PI = Math.PI / 2;

/**
 * Absolute joint angles per pose (0 = facing right, π/2 = down).
 * `arm` is the waving forearm phase (-1..1); `breath` is 0 or 1.
 */
function poseAngles(pose, { arm = 0, breath = 0 } = {}) {
  const b = breath ? 0.03 : 0;
  if (pose === "wave") {
    const torso = -HALF_PI - 0.04;
    // between waves the near arm hangs like the far one
    const rest = arm === "rest";
    return [
      0,
      torso,
      torso + 0.12,
      HALF_PI - 0.06,
      HALF_PI + 0.04,
      rest ? HALF_PI - 0.22 + b : -0.75 - b,
      rest ? HALF_PI - 0.05 : -HALF_PI - 0.1 + arm * 0.42,
      HALF_PI + 0.32 + b,
      HALF_PI + 0.12,
    ];
  }
  if (pose === "sit") {
    const torso = -HALF_PI - 0.36;
    return [
      0,
      torso,
      torso + 0.3,
      -0.12,
      0.48,
      HALF_PI - 0.45 - b,
      -0.05,
      HALF_PI - 0.3 - b,
      0.05,
    ];
  }
  // sleep: lying back along the backrest, head rolled, hands on the belly
  const torso = -HALF_PI - 0.62;
  return [
    0,
    torso,
    torso - 0.35,
    -0.12,
    0.46,
    HALF_PI - 0.15 + b,
    -0.55,
    HALF_PI + 0.05 + b,
    -0.5,
  ];
}

/** Torso grows on the in-breath; everything else keeps its length. */
function poseLengths(breath) {
  const len = BASE_LEN.slice();
  if (breath) len[1] += 1.1;
  return len;
}

/** The crown of upstream's hat01, without its trailing ribbon. */
function cap(p0, p1) {
  return poly(
    Man.tranpoly(p0, p1, [
      [-0.3, 0.5],
      [0.3, 0.8],
      [0.2, 1],
      [0, 1.1],
      [-0.3, 1.15],
      [-0.55, 1],
      [-0.65, 0.5],
    ]),
    { fil: "rgba(100,100,100,0.8)" },
  );
}

/** A brush-stroke "z" of height h centred on (x, y). */
function zee(x, y, h, a) {
  const w = h * 0.8;
  return line(
    [
      [x - w / 2, y - h / 2],
      [x + w / 2, y - h / 2],
      [x - w / 2, y + h / 2],
      [x + w / 2, y + h / 2],
    ],
    { wid: Math.max(0.8, h * 0.09), col: ink(a), seg: 3 },
  );
}

/**
 * The person, posed on/beside the chair whose rear foot is at (x, y).
 * frame: { arm, breath, z } — z is how many "z"s are showing when asleep.
 */
export function person(pose, x, y, s, frame = {}) {
  seed(PERSON_SEED); // identical brush wobble on every frame
  const breath = frame.breath || 0;
  const abs = poseAngles(pose, frame);
  const len = poseLengths(breath);
  const rel = relative(abs);
  const pts = joints(abs, len.map((v) => v * s));

  let hip;
  if (pose === "wave") {
    const P = chairGeometry(x, y, s);
    // up out of the chair, standing just past the footrest and a step forward
    hip = [P.footEnd[0] + 12 * s, y + 3 * s - pts[4][1]];
  } else {
    const P = chairGeometry(x, y, s);
    hip = add(P.seatBack, [3 * s, -7 * s]);
  }

  let canv = Man.man(hip[0], hip[1] + pts[4][1], {
    sca: s,
    fli: false,
    ang: rel,
    len,
    hat: cap,
  });

  if (pose === "sleep" && frame.z) {
    const head = add(hip, pts[2]);
    for (let i = 0; i < frame.z; i++) {
      const h = (5 + i * 2.5) * s;
      canv += zee(head[0] + (8 + i * 9) * s, head[1] - (6 + i * 10) * s, h, 0.55 - i * 0.1);
    }
  }
  return canv;
}

/** World-space bbox helper input: where the person's hotspot should sit. */
export function personAnchor(pose, x, y, s) {
  const P = chairGeometry(x, y, s);
  if (pose === "wave") return [P.footEnd[0] + 12 * s, y + 3 * s];
  return add(P.seatBack, [3 * s, 0]);
}

/* -------------------------------------------------------------------------- */
/* Roof                                                                       */
/* -------------------------------------------------------------------------- */

/** Arch.roof plus tile rows down its front slope (geometry mirrors roof()). */
function tiledRoof(x, y, { hei, wid, rot, per, cor, wei, s }) {
  let canv = Arch.roof(x, y, { hei, wid, rot, per, cor, wei });
  const mid = -wid * 0.5 + wid * rot;
  const quat = (wid * (1 - rot)) / 2;
  const ridge = [
    [x - wid * 0.5 + quat, y - hei - per / 2],
    [x + mid + quat, y - hei],
  ];
  const eave = [
    [x - wid * 0.5 - cor, y],
    [x + mid + cor, y + per],
  ];
  const rows = Math.round(wid / (5 * s));
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    canv += line([lerp(ridge[0], ridge[1], t), lerp(eave[0], eave[1], t)], {
      wid: 0.7 * s,
      col: ink(0.28),
      seg: 3,
    });
  }
  canv += line(ridge, { wid: 2 * s, col: ink(0.5), seg: 8 });
  return canv;
}

/* -------------------------------------------------------------------------- */
/* Notice board                                                               */
/* -------------------------------------------------------------------------- */

function rect(cx, cy, w, h, rot) {
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([u, v]) => [cx + u * c - v * sn, cy + u * sn + v * c]);
}

export function noticeBoard(x, y, s) {
  const postX = 25 * s;
  const top = -92 * s;
  const panel = { x0: -31 * s, x1: 31 * s, y0: -80 * s, y1: -38 * s };
  let canv = "";

  // posts + crossbar
  canv += line([[x - postX, y + 1 * s], [x - postX + 0.5 * s, y + top]], { wid: 2.2 * s, col: ink(0.55) });
  canv += line([[x + postX, y + 1 * s], [x + postX - 0.5 * s, y + top]], { wid: 2.2 * s, col: ink(0.55) });
  canv += line([[x - postX, y - 18 * s], [x + postX, y - 18 * s]], { wid: 1.4 * s, col: ink(0.45) });

  // board panel
  const pnl = [
    [x + panel.x0, y + panel.y0],
    [x + panel.x1, y + panel.y0],
    [x + panel.x1, y + panel.y1],
    [x + panel.x0, y + panel.y1],
  ];
  canv += poly(pnl, { fil: "white", str: "none" });
  canv += line(pnl.concat([pnl[0]]), { wid: 1.8 * s, col: ink(0.5), seg: 8 });
  canv += line(
    [
      [x + panel.x0 + 3 * s, y + panel.y0 + 3 * s],
      [x + panel.x1 - 3 * s, y + panel.y0 + 3 * s],
      [x + panel.x1 - 3 * s, y + panel.y1 - 3 * s],
      [x + panel.x0 + 3 * s, y + panel.y1 - 3 * s],
      [x + panel.x0 + 3 * s, y + panel.y0 + 3 * s],
    ],
    { wid: 0.8 * s, col: ink(0.3), seg: 8 },
  );

  // pinned sheets
  const sheets = [
    [-17, -60, 15, 19, -0.08],
    [1, -63, 13, 16, 0.05],
    [18, -58, 15, 18, 0.1],
  ];
  for (const [cx, cy, w, h, r] of sheets) {
    const q = rect(x + cx * s, y + cy * s, w * s, h * s, r);
    canv += poly(q, { fil: "white", str: "none" });
    canv += line(q.concat([q[0]]), { wid: 0.9 * s, col: ink(0.45), seg: 4 });
    const lines = Math.round(h / 4.5);
    for (let i = 1; i < lines; i++) {
      const t = i / lines;
      const a = lerp(q[0], q[3], t);
      const b = lerp(q[1], q[2], t);
      const end = 0.55 + 0.35 * Noise.noise(cx, i * 0.7);
      canv += line([lerp(a, b, 0.15), lerp(a, b, end)], { wid: 0.7 * s, col: ink(0.35), seg: 3 });
    }
    const pin = lerp(q[0], q[1], 0.5);
    canv += poly(rect(pin[0], pin[1] + 1 * s, 2 * s, 2 * s, 0.6), { fil: ink(0.6), str: "none" });
  }

  // little tiled roof
  canv += tiledRoof(x, y + top + 2 * s, {
    hei: 13 * s,
    wid: 72 * s,
    rot: 0.62,
    per: 3 * s,
    cor: 6 * s,
    wei: 1.5,
    s,
  });
  return canv;
}

/* -------------------------------------------------------------------------- */
/* Bookshelf pavilion                                                         */
/* -------------------------------------------------------------------------- */

export function bookshelfPavilion(x, y, s) {
  const wid = 54 * s;
  const hei = 50 * s;
  const rot = 0.82;
  const per = 5 * s;
  const mid = -wid * 0.5 + wid * rot;
  const pul = [x - wid / 2, y - hei];
  const pur = [x + mid, y - hei + per];
  const pdl = [x - wid / 2, y];
  const pdr = [x + mid, y + per];
  const face = (u, v) => lerp(lerp(pul, pur, u), lerp(pdl, pdr, u), v);
  let canv = "";

  // stone plinth
  canv += Arch.box(x, y + 4 * s, { hei: 4 * s, wid: wid * 1.5, rot, per: per * 1.4, tra: false, wei: 1.2 });

  // pavilion posts (behind the shelf) and roof
  const postTop = y - 72 * s;
  for (const px of [-wid * 0.66, wid * 0.62]) {
    canv += line([[x + px, y + 2 * s], [x + px, postTop]], { wid: 1.8 * s, col: ink(0.5) });
  }

  // the shelf carcass
  canv += Arch.box(x, y, { hei, wid, rot, per, tra: false, wei: 1.5 });

  // shelves and books
  const levels = 3;
  for (let lv = 0; lv < levels; lv++) {
    const v0 = lv / levels;
    const v1 = (lv + 1) / levels;
    if (lv > 0) canv += line([face(0.02, v0), face(0.98, v0)], { wid: 1.3 * s, col: ink(0.5) });

    let u = 0.06;
    let k = 0;
    while (u < 0.9) {
      k++;
      const n = Noise.noise(lv * 3.1, k * 0.9);
      if (lv === 1 && k === 4) {
        // a stack of books lying flat
        for (let i = 0; i < 3; i++) {
          const vb = v1 - 0.03 - i * 0.075;
          const q = [face(u, vb - 0.07), face(u + 0.2, vb - 0.07), face(u + 0.2, vb), face(u, vb)];
          canv += poly(q, { fil: "white", str: "none" });
          canv += line(q.concat([q[0]]), { wid: 0.8 * s, col: ink(0.45), seg: 3 });
        }
        u += 0.25;
        continue;
      }
      if (lv === 2 && k === 3) {
        // two scrolls, round end out
        for (let i = 0; i < 2; i++) {
          const c = face(u + 0.05 + i * 0.09, v1 - 0.09);
          const r = 3 * s;
          const ring = [];
          for (let a = 0; a <= 12; a++) ring.push([c[0] + r * Math.cos((a / 12) * 2 * Math.PI), c[1] + r * Math.sin((a / 12) * 2 * Math.PI)]);
          canv += poly(ring, { fil: "white", str: "none" });
          canv += line(ring, { wid: 0.8 * s, col: ink(0.5), seg: 1 });
        }
        u += 0.22;
        continue;
      }
      const bw = 0.045 + 0.035 * n;
      const bh = 0.55 + 0.3 * Noise.noise(k * 1.7, lv);
      const tilt = k % 5 === 0 ? 0.035 : 0;
      const q = [face(u + tilt, v1 - bh * (v1 - v0)), face(u + bw + tilt, v1 - bh * (v1 - v0)), face(u + bw, v1), face(u, v1)];
      canv += poly(q, { fil: "white", str: "none" });
      canv += line(q.concat([q[0]]), { wid: 0.8 * s, col: ink(0.5), seg: 3 });
      canv += line([lerp(q[0], q[3], 0.25), lerp(q[1], q[2], 0.25)], { wid: 0.6 * s, col: ink(0.35), seg: 2 });
      u += bw + 0.012 + (n > 0.62 ? 0.06 : 0);
    }
  }

  canv += tiledRoof(x, postTop, {
    hei: 16 * s,
    wid: 82 * s,
    rot,
    per: per * 1.2,
    cor: 8 * s,
    wei: 1.6,
    s,
  });
  return canv;
}

/* -------------------------------------------------------------------------- */
/* Record player                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Corners of a box seen from a corner, like Arch.box but with its top face
 * visible. Origin is the centre of the bottom diamond; L/F/R/B = left, front,
 * right, back corners.
 */
function blockCorners(x, y, w, h, rot, per) {
  const mid = -w * 0.5 + w * rot;
  const bmid = -w * 0.5 + w * (1 - rot);
  const bot = {
    L: [x - w / 2, y],
    F: [x + mid, y + per],
    R: [x + w / 2, y],
    B: [x + bmid, y - per],
  };
  const top = {};
  for (const k of Object.keys(bot)) top[k] = [bot[k][0], bot[k][1] - h];
  return { bot, top };
}

function block(c, { wei = 1.3, col = ink(0.5) } = {}) {
  const { bot, top } = c;
  let canv = poly([top.L, top.B, top.R, bot.R, bot.F, bot.L], { fil: "white", str: "none" });
  canv += line([top.L, top.B, top.R, top.F, top.L], { wid: wei, col, seg: 4 });
  for (const k of ["L", "F", "R"]) canv += line([top[k], bot[k]], { wid: wei, col, seg: 3 });
  canv += line([bot.L, bot.F, bot.R], { wid: wei, col, seg: 4 });
  return canv;
}

function ellipse(cx, cy, rx, ry, a0 = 0, a1 = 2 * Math.PI, n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

/** Spin frames the record player cycles through while music plays. */
export const SPIN_FRAMES = 8;

/**
 * A turntable on a small side table, left of the chair whose rear foot is at
 * (x, y). frame: { playing, spin } — spin is 0..SPIN_FRAMES-1. When stopped
 * the tonearm rests off the record.
 */
export function recordPlayer(x, y, s, frame = {}) {
  seed("record"); // identical brush wobble on every frame
  const cx = x - 46 * s;
  const legH = 19 * s;
  let canv = "";

  // side table: slab on three visible legs
  const slab = blockCorners(cx, y - legH, 33 * s, 2.5 * s, 0.62, 5.5 * s);
  for (const k of ["L", "F", "R"]) {
    const [lx, ly] = slab.bot[k];
    canv += line([[lx, ly], [lx + (k === "L" ? -1 : k === "R" ? 1 : 0) * s, ly + legH]], { wid: 1.5 * s, col: ink(0.5) });
  }
  canv += block(slab, { wei: 1.3 * s });

  // turntable cabinet on the slab
  const topY = y - legH - 2.5 * s;
  const cab = blockCorners(cx, topY, 26 * s, 5.5 * s, 0.62, 4 * s);
  canv += block(cab, { wei: 1.3 * s, col: ink(0.55) });

  // the record, in perspective on the cabinet top
  const rcx = cx - 1.2 * s;
  const rcy = topY - 5.6 * s;
  const rx = 9.8 * s;
  const ry = 3.3 * s;
  canv += poly(ellipse(rcx, rcy, rx, ry), { fil: "rgba(62,60,56,0.85)", str: "none" });
  canv += line(ellipse(rcx, rcy, rx, ry), { wid: 0.8 * s, col: ink(0.7), seg: 1 });
  for (const r of [0.78, 0.58]) {
    canv += poly(ellipse(rcx, rcy, rx * r, ry * r), { fil: "none", str: "rgba(205,200,190,0.35)", wid: 0.4 * s });
  }
  // the turning shine: two light arcs on opposite sides that step round the
  // disc, so the spin reads even at a few pixels across
  const spin = frame.spin || 0;
  const a = (spin / SPIN_FRAMES) * 2 * Math.PI;
  for (const [off, r] of [[0, 0.72], [Math.PI, 0.52]]) {
    canv += line(ellipse(rcx, rcy, rx * r, ry * r, a + off, a + off + 1.2, 8), {
      wid: 1.6 * s,
      col: "rgba(242,238,228,0.9)",
      seg: 1,
    });
  }
  // label + its dot, which turns with the record
  canv += poly(ellipse(rcx, rcy, rx * 0.3, ry * 0.3), { fil: "white", str: "none" });
  canv += line(ellipse(rcx, rcy, rx * 0.3, ry * 0.3), { wid: 0.5 * s, col: ink(0.6), seg: 1 });
  const dot = [rcx + rx * 0.18 * Math.cos(a + Math.PI), rcy + ry * 0.18 * Math.sin(a + Math.PI)];
  canv += poly(ellipse(dot[0], dot[1], 0.8 * s, 0.45 * s, 0, 2 * Math.PI, 8), { fil: ink(0.8), str: "none" });

  // tonearm: pivot at the back-right of the cabinet
  const pivot = [cx + 10.8 * s, topY - 7.8 * s];
  canv += poly(ellipse(pivot[0], pivot[1], 1.8 * s, 0.9 * s, 0, 2 * Math.PI, 10), { fil: ink(0.6), str: "none" });
  const tip = frame.playing
    ? [rcx + rx * 0.6, rcy - ry * 0.1] // needle down on the outer grooves
    : [pivot[0] + 1.2 * s, pivot[1] + 5.5 * s]; // resting off the record
  const elbow = lerp(pivot, tip, 0.55);
  elbow[1] -= 1.2 * s;
  canv += line([pivot, elbow, tip], { wid: 1.1 * s, col: ink(0.75), seg: 3 });
  canv += poly(
    [
      [tip[0] - 1.6 * s, tip[1] - 0.6 * s],
      [tip[0] + 0.6 * s, tip[1] - 1 * s],
      [tip[0] + 0.9 * s, tip[1] + 0.5 * s],
      [tip[0] - 1.3 * s, tip[1] + 0.9 * s],
    ],
    { fil: ink(0.7), str: "none" },
  );
  return canv;
}

/* -------------------------------------------------------------------------- */
/* Mist                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A band of mist between x0 and x1: paper-white, its opacity following
 * `stops` from the band's top edge (0) to its bottom edge (1). The edges
 * wander with noise and pinch together at the ends so they fade out softly.
 */
export function fogBand(x0, x1, top, bottom, { stops = [0, 0, 0.55, 0.75, 1, 0.9], wobble = 16, key = 0 } = {}) {
  const step = Math.max(6, (x1 - x0) / 60);
  const upper = [];
  const lower = [];
  for (let x = x0; x <= x1 + 0.01; x += step) {
    const u = (x - x0) / (x1 - x0);
    const pinch = Math.pow(Math.sin(Math.PI * u), 0.35);
    const mid = (top + bottom) / 2;
    const t = top - Noise.noise(x * 0.008, key) * wobble;
    const b = bottom + (Noise.noise(x * 0.011, key + 7) - 0.3) * wobble * 0.5;
    upper.push([x, mid + (t - mid) * pinch]);
    lower.push([x, mid + (b - mid) * pinch]);
  }
  const ring = upper.concat(lower.reverse());
  const pts = [];
  for (const [x, y] of ring) pts.push(x, y);
  const y0 = top - wobble;
  const y1 = bottom + wobble * 0.5;
  // the lower edge always fades to nothing before the outline's highest dip, so
  // a band never ends in a hard line across the trees and water behind it
  const at = (y) => (y - y0) / (y1 - y0);
  return emitOp({ k: "f", pts, y0, y1, stops: softBottom(stops, at(bottom - (bottom - top) * 0.3), at(bottom - wobble * 0.25)) });
}

/** Gradient stops cut at offset `from` and faded to transparent by `to`. */
function softBottom(stops, from, to) {
  const out = [];
  for (let i = 0; i < stops.length; i += 2) {
    const o = stops[i];
    const a = stops[i + 1];
    if (o < from) {
      out.push(o, a);
      continue;
    }
    const po = i ? stops[i - 2] : 0;
    const pa = i ? stops[i - 1] : a;
    out.push(from, o === po ? a : pa + ((a - pa) * (from - po)) / (o - po));
    break;
  }
  out.push(Math.max(from, to), 0, 1, 0);
  return out;
}

/* -------------------------------------------------------------------------- */
/* Clouds                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A soft ink-wash cloud centred on (x, y): overlapping pale blobs, denser along
 * the flat underside, with a couple of faint brush lines tracing the top.
 */
export function inkCloud(x, y, w, h) {
  let canv = "";
  const n = Math.max(6, Math.round(w / 18));
  const top = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const dome = Math.sin(Math.PI * u);
    const cx = x - w / 2 + u * w + (random() - 0.5) * w * 0.05;
    const cy = y - dome * h * 0.35 + (random() - 0.5) * h * 0.15;
    const len = (0.4 + 0.6 * dome) * h * 1.9;
    canv += blob(cx, cy, {
      len,
      wid: len * (0.42 + random() * 0.18),
      ang: (random() - 0.5) * 0.25,
      col: "rgba(120,120,120," + (0.035 + random() * 0.035).toFixed(3) + ")",
      noi: 0.6,
    });
    top.push([cx, cy - len * 0.24]);
  }
  // denser underside: a long flat wash along the bottom
  for (let i = 0; i < 3; i++) {
    canv += blob(x + (random() - 0.5) * w * 0.1, y + h * 0.18, {
      len: w * (0.75 - i * 0.15),
      wid: h * 0.35,
      col: "rgba(110,110,110,0.05)",
      noi: 0.5,
    });
  }
  canv += stroke(div(top, 3), { wid: 1.1, col: "rgba(100,100,100,0.16)", noi: 0.8 });
  return canv;
}

/* -------------------------------------------------------------------------- */
/* Lake                                                                       */
/* -------------------------------------------------------------------------- */

/** How many water drawings the lake cycles through. */
export const WATER_FRAMES = 3;

/**
 * Ripple strokes that fill the lake in perspective: rows packed tightly near
 * the horizon and spreading towards the viewer, with dashes that grow longer,
 * thicker and darker as they come closer. Dashes are clipped to the water
 * (lake.open(y) gives the open [x0, x1] spans at a row), and each frame slides
 * them a third of their spacing to the right, so the three drawings read as
 * water flowing, faster in front than far away.
 */
export function lakeRipples(lake, frame) {
  const { horizon, bottom } = lake;
  let canv = "";
  let y = horizon + 1.5;
  let row = 0;
  while (y < bottom) {
    const d = (y - horizon) / (bottom - horizon);
    const period = 26 + 150 * Math.pow(d, 1.35);
    const dash = 5 + 66 * Math.pow(d, 1.2);
    const wid = 0.45 + 1.6 * d;
    const alpha = 0.09 + 0.45 * d;
    const sag = 0.3 + 2.2 * d;
    const shift = (frame / WATER_FRAMES) * period;
    const phase = Noise.noise(row * 0.37, 3.3) * period + shift;
    const gap = 3.2 + 30 * Math.pow(d, 1.6);
    for (const [a0, a1] of lake.open(y)) {
      const k0 = Math.floor((a0 - phase) / period) - 1;
      const k1 = Math.ceil((a1 - phase) / period) + 1;
      for (let k = k0; k <= k1; k++) {
        const x = phase + k * period;
        if (lake.hidden(x, y)) continue;
        // calm patches: a slow noise field (fixed to the water, not the
        // dashes) thins the ripples out, as if the surface caught the sky
        // (calmer still in the distance, where even rows would read as a grid)
        if (Noise.noise((x - shift) * 0.0035, y * 0.011, 5) < 0.42 + 0.16 * (1 - d)) continue;
        // ripples come in short trains of 1-3 dashes
        const train = 1 + Math.floor(Noise.noise(k * 0.63, row * 0.29 + 4) * 3);
        for (let j = 0; j < train; j++) {
          const len = dash * (0.45 + Noise.noise(k * 0.73 + j, row * 0.53 + 9) * 0.9);
          const off = (Noise.noise(k * 0.91 + j * 2.1, row * 0.31) - 0.5) * period * 0.5 + j * len * 1.25;
          const s0 = Math.max(a0, x + off);
          const s1 = Math.min(a1, x + off + len);
          if (s1 - s0 < 2) continue;
          const yy = y + (Noise.noise(k * 1.3 + j, row * 0.7) - 0.5) * gap * 0.5;
          const pts = [];
          for (let i = 0; i <= 6; i++) {
            const t = i / 6;
            // a gentle S rather than a lens
            pts.push([s0 + (s1 - s0) * t, yy + Math.sin(t * Math.PI * 2) * sag * 0.35]);
          }
          canv += stroke(pts, {
            wid,
            col: "rgba(100,100,100," + (alpha * (0.6 + 0.4 * Noise.noise(k, row + 1 + j))).toFixed(3) + ")",
            noi: 0.45,
          });
        }
      }
    }
    y += gap;
    row++;
  }
  return canv;
}
