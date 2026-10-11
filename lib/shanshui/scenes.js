// @ts-nocheck
/*
 * The two fixed compositions. Elements are listed back-to-front (painter's
 * order) and each one is reseeded from `${SEED}/${id}` before it draws, so
 * tweaking one element never reshuffles the others.
 *
 * Coordinates are world units, y down. `t` is the element's window in the
 * intro timeline, in seconds. `plane` is the depth layer the element is baked
 * into (sky → clouds → far → mid → water → near); planes move at different
 * rates when the scroll zoom pushes in, and mist bands between them fade the
 * distance out, like atmospheric haze in an ink painting. `clip` cuts an
 * element off above a line and `flatBase` closes a terrace's white backing
 * straight across its foot (see clip.js), so neighbours meet cleanly.
 *
 * The lake is shaped by the mid mountains: it reaches back to the horizon and
 * is painted behind them, so their flanks hide the far water and only the water
 * below each base lies in front.
 *
 * The objects live in a bottom-left vignette, staggered in depth: person,
 * chair and record player in front on a terrace in the corner, the notice board
 * a step up and to the right, the bookshelf pavilion behind and above on a
 * ledge that caps the corner cliff.
 */
import { Arch, Mount, random } from "./engine.js";
import { WATER_FRAMES, fogBand, inkCloud, lakeRipples, paperFade } from "./objects.js";

export const SEED = "vyxed";

/** Where an object stands on a terrace's plateau. */
export function stand(ground, fx, fallback) {
  if (!ground) return fallback;
  return [
    ground.xmin + (ground.xmax - ground.xmin) * fx,
    ground.ymin + (ground.ymax - ground.ymin) * 0.6,
  ];
}

/**
 * The corner cliff, capped by the bookshelf's ledge at height capY. Upstream's
 * outline scales with `hei` (its random draws don't depend on it), so we
 * measure it once (ret mode) and pick the height at which the cliff is capWid
 * wide at capY. The element's `clip` then cuts away everything above that line,
 * so the ledge sits on the cliff as its summit: no corner hanging in the air,
 * no peak rising behind the pavilion. The span is left in g.cap for the ledge.
 */
function cappedCliff(g, reseed, x, y, seed, args, capY, capWid) {
  const outline = Mount.mountain(x, y, seed, Object.assign({}, args, { hei: 1000, ret: 1 }))[0][0];
  // the outline's ends sit at this offset whatever the height; the rest scales
  const hoff = outline[0][1];
  const spanAt = (hei) => {
    const yr = capY - y;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 1; i < outline.length; i++) {
      const [ax, ay0] = outline[i - 1];
      const [bx, by0] = outline[i];
      const ay = hoff + ((ay0 - hoff) * hei) / 1000;
      const by = hoff + ((by0 - hoff) * hei) / 1000;
      if ((ay - yr) * (by - yr) <= 0 && ay !== by) {
        const cx = ax + ((yr - ay) / (by - ay)) * (bx - ax);
        lo = Math.min(lo, cx);
        hi = Math.max(hi, cx);
      }
    }
    return hi > lo ? [x + lo, x + hi] : null;
  };
  let a = 100;
  let b = 3000;
  for (let k = 0; k < 40; k++) {
    const m = (a + b) / 2;
    const s = spanAt(m);
    if (!s || s[1] - s[0] < capWid) a = m;
    else b = m;
  }
  const [x0, x1] = spanAt(b);
  g.cap = { y: capY, x0, x1 };
  reseed();
  return Mount.mountain(x, y, seed, Object.assign({}, args, { hei: b }));
}

/**
 * A low wash along a terrace's waterline (just below y, flatMount's ends sit a
 * little under it), so its foot sinks into mist, and whatever it stands in
 * front of fades out there rather than being cut off by its base.
 */
function footMist(x, y, wid, key) {
  return fogBand(x - wid * 0.62, x + wid * 0.6, y - 10, y + 22, { stops: [0, 0, 0.5, 0.85, 1, 0.85], wobble: 6, key });
}

function terrace(g, key, x, y, seed, args) {
  const canv = Mount.flatMount(x, y, seed, Object.assign({ dec: false }, args));
  g[key] = Mount.lastGround;
  return canv;
}

/**
 * The bookshelf's ledge, set exactly on the cliff's cut: flatMount's outline
 * runs from x − wid/2 to x + 0.48·wid, and its ends sit lower than y by a
 * random offset (its first draw, y/100 at most), which we peek and undo.
 */
function capLedge(g, reseed, seed, args) {
  const { y, x0, x1 } = g.cap;
  const r = random();
  reseed();
  const wid = (x1 - x0) / 0.98;
  return terrace(g, "shelf", x0 + wid / 2, y / (1 + r / 100), seed, Object.assign({}, args, { wid }));
}

/**
 * The lake's surface, from the mountains standing in it. top(x) is where the
 * water starts at column x: the base of the frontmost mountain over x, or the
 * horizon where there's a gap between them.
 */
export function makeLake({ horizon, bottom, x0, x1, shore }) {
  const top = (x) => {
    let y = horizon;
    for (const m of shore) if (Math.abs(x - m.x) < m.wid * 0.47) y = Math.max(y, m.y + 6);
    return y;
  };
  const open = (y) => {
    const spans = [];
    let start = null;
    for (let x = x0; x <= x1; x += 4) {
      const wet = y >= top(x);
      if (wet && start === null) start = x;
      if (!wet && start !== null) {
        spans.push([start, x]);
        start = null;
      }
    }
    if (start !== null) spans.push([start, x1]);
    return spans;
  };
  // deep behind a mountain's body: ripples there would never be seen
  const hidden = (x, y) => shore.some((m) => Math.abs(x - m.x) < m.wid * 0.36 && y < m.y - 30);
  const poly = [];
  for (let x = x0; x <= x1; x += 6) poly.push(x, top(x));
  poly.push(x1, top(x1), x1, bottom, x0, bottom);
  return { horizon, bottom, x0, x1, top, open, hidden, poly };
}

/** Clouds that tile horizontally with period `tile`, so they can drift forever. */
function cloudBank(tile, clouds) {
  let canv = "";
  for (const [x, y, w, h] of clouds) {
    for (const dx of [-tile, 0, tile]) canv += inkCloud(x + dx, y, w, h);
  }
  return canv;
}

/* -------------------------------------------------------------------------- */

const WIDE_LAKE = makeLake({
  horizon: 452,
  bottom: 930,
  x0: -300,
  x1: 2150,
  shore: [
    { x: 1290, y: 640, wid: 470 },
    { x: 990, y: 600, wid: 380 },
    { x: 650, y: 790, wid: 560 },
  ],
});

export const WIDE = {
  w: 1600,
  h: 900,
  // the bottom part of the world that must stay visible; the sky above it may
  // be cropped on short viewports
  minH: 780,
  cloudTile: 2000,
  lake: WIDE_LAKE,
  // what the scroll zoom ends on: the vignette
  focus: { x0: 70, y0: 515, x1: 590, y1: 905 },
  planes: {
    sky: { x0: -300, y0: 0, x1: 2150, y1: 470 },
    clouds: { x0: 0, y0: 0, x1: 2000, y1: 330 },
    far: { x0: -300, y0: 120, x1: 2150, y1: 480 },
    mid: { x0: 320, y0: 100, x1: 1800, y1: 870 },
    water: { x0: -300, y0: 440, x1: 2150, y1: 935 },
    near: { x0: -320, y0: 380, x1: 780, y1: 965 },
  },
  elements: [
    // a pale, far range so the sky isn't empty, dissolving into mist at its foot
    { id: "range", plane: "sky", t: [0, 1.2], draw: () => Mount.distMount(-300, 385, 13, { hei: 330, len: 2450, seg: 5, tri: 600 }) + fogBand(-320, 2170, 110, 395, { stops: [0, 0.35, 0.6, 0.62, 1, 0.92], wobble: 10, key: 1 }) },
    { id: "clouds", plane: "clouds", t: [0.2, 1.6], draw: () => cloudBank(2000, [[200, 150, 380, 70], [720, 95, 290, 52], [1130, 190, 430, 78], [1590, 115, 320, 60], [1880, 215, 240, 46]]) },
    { id: "far-left", plane: "far", t: [0.3, 1.5], draw: () => Mount.distMount(-120, 430, 2, { hei: 230, len: 1000, tri: 220 }) },
    { id: "far-right", plane: "far", t: [0.5, 1.8], draw: () => Mount.distMount(640, 410, 5, { hei: 210, len: 1500, tri: 220 }) },
    // settles with the far hills, so they ink in already hazy
    { id: "far-mist", plane: "far", t: [0.3, 1.5], draw: () => fogBand(-320, 2170, 350, 455, { key: 2 }) },
    { id: "back-right", plane: "mid", reflect: 640, t: [0.8, 2.4], draw: () => Mount.mountain(1290, 640, 3, { hei: 700, wid: 470, tex: 220 }) },
    { id: "back-mid", plane: "mid", reflect: 600, t: [1.0, 2.6], draw: () => Mount.mountain(990, 600, 9, { hei: 480, wid: 380, tex: 150, arch: false }) },
    // the back peaks recede: a light wash, densest at their feet
    { id: "back-haze", plane: "mid", t: [2.0, 2.8], draw: () => fogBand(760, 1640, 230, 610, { stops: [0, 0.12, 0.7, 0.3, 1, 0.55], wobble: 8, key: 3 }) + fogBand(1020, 1570, 560, 650, { key: 4 }) + fogBand(770, 1210, 520, 610, { key: 5 }) },
    { id: "main", plane: "mid", reflect: 790, t: [1.3, 3.8], draw: () => Mount.mountain(650, 790, 7, { hei: 1050, wid: 560, tex: 320, arch: false }) },
    // a cloud wrapped round the main mountain's waist, and mist at its foot
    { id: "main-mist", plane: "mid", t: [3.2, 4.2], draw: () => fogBand(420, 920, 405, 480, { stops: [0, 0, 0.5, 0.82, 1, 0], wobble: 12, key: 6 }) + fogBand(350, 960, 712, 800, { key: 7 }) },
    { id: "lake", plane: "water", t: [3.0, 4.6], frames: WATER_FRAMES, draw: (g, reseed, frame) => lakeRipples(WIDE_LAKE, frame) },
    { id: "boats", plane: "water", t: [3.6, 4.6], draw: () => Arch.boat01(1110, 788, 1, { sca: 0.9 }) + Arch.boat01(1390, 852, 2, { sca: 1.1, fli: true }) },
    // a veil of mist behind the corner, so it stands forward of the lake
    { id: "near-mist", plane: "near", t: [3.3, 4.2], draw: () => fogBand(-320, 780, 690, 880, { stops: [0, 0, 0.5, 0.5, 1, 0.65], key: 8 }) },
    { id: "cliff", plane: "near", t: [3.4, 5.0], clip: (g) => g.cap.y, draw: (g, reseed) => cappedCliff(g, reseed, 110, 1010, 11, { wid: 520, tex: 240, arch: false }, 690, 240) },
    { id: "ledge", plane: "near", flatBase: true, t: [4.0, 4.9], draw: (g, reseed) => capLedge(g, reseed, 4, { hei: 80, cho: 0.55 }) },
    { id: "hill", plane: "near", flatBase: true, t: [4.4, 5.3], draw: (g) => terrace(g, "board", 470, 800, 6, { wid: 320, hei: 70, cho: 0.45 }) + footMist(470, 800, 320, 12) },
    { id: "terrace", plane: "near", flatBase: true, t: [4.8, 5.8], draw: (g) => terrace(g, "lounge", 240, 900, 8, { wid: 680, hei: 80, cho: 0.6 }) },
  ],
  objects: (g) => ({
    shelf: { at: stand(g.shelf, 0.5, [150, 640]), s: 1.25, t: [5.4, 6.4] },
    board: { at: stand(g.board, 0.5, [470, 750]), s: 1.45, t: [5.8, 6.7] },
    lounge: { at: stand(g.lounge, 0.31, [198, 840]), s: 1.6, t: [6.2, 7.4] },
  }),
};

/* -------------------------------------------------------------------------- */

const TALL_LAKE = makeLake({
  horizon: 792,
  bottom: 1980,
  x0: -300,
  x1: 1300,
  shore: [
    { x: 700, y: 1120, wid: 420 },
    { x: 210, y: 1080, wid: 360 },
    { x: 500, y: 1460, wid: 580 },
  ],
});

// Phone-shaped (about 0.45) so a hanging-scroll stack fills the screen. A
// 9:16 phone, or a taller one behind its browser bars, shows the full height
// (minH, from the clouds down) and a little more lake to the right instead.
// The ground fades into the paper along the bottom, so whatever shows below
// it (browser bars sliding away) is just more paper.
export const TALL = {
  w: 900,
  h: 2010,
  minH: 1780,
  cloudTile: 1300,
  lake: TALL_LAKE,
  focus: { x0: 70, y0: 1420, x1: 610, y1: 1955 },
  planes: {
    sky: { x0: -300, y0: 120, x1: 1300, y1: 800 },
    clouds: { x0: 0, y0: 120, x1: 1300, y1: 620 },
    far: { x0: -300, y0: 420, x1: 1300, y1: 810 },
    mid: { x0: -150, y0: 250, x1: 1200, y1: 1540 },
    water: { x0: -300, y0: 780, x1: 1310, y1: 1985 },
    near: { x0: -320, y0: 1150, x1: 800, y1: 1990 },
  },
  elements: [
    { id: "range", plane: "sky", t: [0, 1.2], draw: () => Mount.distMount(-300, 690, 13, { hei: 400, len: 1600, seg: 5, tri: 600 }) + fogBand(-320, 1320, 330, 700, { stops: [0, 0.35, 0.6, 0.62, 1, 0.92], wobble: 10, key: 1 }) },
    // clear of the top edge, and of the top-right corner where the song player sits
    { id: "clouds", plane: "clouds", t: [0.2, 1.6], draw: () => cloudBank(1300, [[170, 345, 330, 62], [610, 460, 260, 50], [1060, 400, 280, 54], [400, 565, 240, 44]]) },
    { id: "far", plane: "far", t: [0.3, 1.6], draw: () => Mount.distMount(-120, 760, 2, { hei: 280, len: 1150, tri: 220 }) },
    { id: "far-mist", plane: "far", t: [0.3, 1.6], draw: () => fogBand(-320, 1320, 690, 795, { key: 2 }) },
    { id: "back-right", plane: "mid", reflect: 1120, t: [0.6, 2.3], draw: () => Mount.mountain(700, 1120, 3, { hei: 1350, wid: 420, tex: 220 }) },
    { id: "back-left", plane: "mid", reflect: 1080, t: [0.9, 2.6], draw: () => Mount.mountain(210, 1080, 9, { hei: 900, wid: 360, tex: 160, arch: false }) },
    { id: "back-haze", plane: "mid", t: [2.0, 2.8], draw: () => fogBand(-160, 1200, 420, 1100, { stops: [0, 0.12, 0.7, 0.3, 1, 0.55], wobble: 8, key: 3 }) + fogBand(470, 940, 1040, 1130, { key: 4 }) + fogBand(10, 410, 1000, 1090, { key: 5 }) },
    { id: "main", plane: "mid", reflect: 1460, t: [1.2, 3.7], draw: () => Mount.mountain(500, 1460, 7, { hei: 1500, wid: 580, tex: 340, arch: false }) },
    { id: "main-mist", plane: "mid", t: [3.1, 4.1], draw: () => fogBand(230, 780, 980, 1060, { stops: [0, 0, 0.5, 0.82, 1, 0], wobble: 12, key: 6 }) + fogBand(190, 810, 1380, 1470, { key: 7 }) },
    { id: "lake", plane: "water", t: [2.9, 4.4], frames: WATER_FRAMES, draw: (g, reseed, frame) => lakeRipples(TALL_LAKE, frame) },
    { id: "boats", plane: "water", t: [3.4, 4.4], draw: () => Arch.boat01(680, 1520, 1, { sca: 1 }) },
    { id: "near-mist", plane: "near", t: [3.2, 4.1], draw: () => fogBand(-320, 800, 1560, 1760, { stops: [0, 0, 0.5, 0.5, 1, 0.65], key: 8 }) },
    { id: "cliff", plane: "near", t: [3.3, 5.0], clip: (g) => g.cap.y, draw: (g, reseed) => cappedCliff(g, reseed, 110, 1910, 11, { wid: 520, tex: 240, arch: false }, 1565, 240) },
    { id: "ledge", plane: "near", flatBase: true, t: [4.0, 4.9], draw: (g, reseed) => capLedge(g, reseed, 4, { hei: 80, cho: 0.55 }) },
    { id: "hill", plane: "near", flatBase: true, t: [4.4, 5.3], draw: (g) => terrace(g, "board", 470, 1740, 6, { wid: 330, hei: 70, cho: 0.45 }) + footMist(470, 1740, 330, 12) },
    { id: "terrace", plane: "near", flatBase: true, t: [4.8, 5.8], draw: (g) => terrace(g, "lounge", 250, 1925, 8, { wid: 680, hei: 80, cho: 0.6 }) },
    // the foot of the corner sinks into the paper
    { id: "ground-mist", plane: "near", t: [4.8, 5.8], draw: () => paperFade(-320, 800, 1910, 1968, 2120, { key: 13 }) },
  ],
  objects: (g) => ({
    shelf: { at: stand(g.shelf, 0.5, [160, 1510]), s: 1.4, t: [5.4, 6.4] },
    board: { at: stand(g.board, 0.5, [470, 1690]), s: 1.6, t: [5.8, 6.7] },
    lounge: { at: stand(g.lounge, 0.46, [240, 1880]), s: 1.75, t: [6.2, 7.4] },
  }),
};
