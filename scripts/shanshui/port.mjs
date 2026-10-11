// Ports the generator out of shan-shui-inf's index.html into lib/shanshui/engine.js.
// Every edit is an exact-match replacement that fails loudly if upstream moved.
//
// usage (from the repo root, with upstream's two files downloaded somewhere):
//   curl -LO https://raw.githubusercontent.com/LingDong-/shan-shui-inf/master/index.html
//   curl -LO https://raw.githubusercontent.com/LingDong-/shan-shui-inf/master/LICENSE
//   node scripts/shanshui/port.mjs index.html LICENSE lib/shanshui/engine.js
import { readFileSync, writeFileSync } from "node:fs";

const [, , srcPath, licPath, outPath] = process.argv;
const lines = readFileSync(srcPath, "utf8").split("\n");
const license = readFileSync(licPath, "utf8").trim();

const pick = (a, b) => lines.slice(a - 1, b).join("\n");

let body = [
  pick(2, 53), // Prng
  pick(89, 203), // Noise
  pick(207, 382), // PolyTools
  pick(386, 510), // Util (incl. poly)
  pick(516, 3705), // stroke … Man, water
].join("\n\n");

function rep(from, to, count = 1) {
  const n = body.split(from).length - 1;
  if (n !== count) {
    throw new Error(`expected ${count} match(es), got ${n}: ${from.slice(0, 80)}`);
  }
  body = body.split(from).join(to);
}

// --- environment ---------------------------------------------------------
rep("window.btoa(", "btoa(");
rep('      console.log(["int seed", Prng.s]);\n', "");
rep('        console.log("ERRR");\n        console.log(plist)\n', "");
rep("            console.log(plist);\n            console.log(err);\n", "");

// --- strict mode: implicit globals --------------------------------------
rep("    vtxlist0 = [];\n    vtxlist1 = [];\n    vtxlist = [];", "    var vtxlist0 = [];\n    var vtxlist1 = [];\n    var vtxlist = [];");
rep("      vtxlist0 = [];\n      vtxlist1 = [];\n      vtxlist = [];", "      var vtxlist0 = [];\n      var vtxlist1 = [];\n      var vtxlist = [];");
rep("\n      reso = 10;\n", "\n      var reso = 10;\n", 3);

// --- reseeding also rebuilds the lazily-filled Perlin table ---------------
rep(
  "    this.noiseSeed = function(seed) {",
  "    this.reset = function() {\n      perlin = null;\n    };\n    this.noiseSeed = function(seed) {",
);

// --- op capture: poly() --------------------------------------------------
rep(
  `    var canv = "<polyline points='";
    for (var i = 0; i < plist.length; i++) {
      canv +=
        " " +
        (plist[i][0] + xof).toFixed(1) +
        "," +
        (plist[i][1] + yof).toFixed(1);
    }
    canv +=
      "' style='fill:" +
      fil +
      ";stroke:" +
      str +
      ";stroke-width:" +
      wid +
      "'/>";
    return canv;`,
  `    return emitPoly(plist, xof, yof, fil, str, wid);`,
);

// --- op capture: stroke() keeps both sides for the draw-on reveal ---------
rep(
  `    vtxlist = [ptlist[0]]
      .concat(
        vtxlist0.concat(vtxlist1.concat([ptlist[ptlist.length - 1]]).reverse()),
      )
      .concat([ptlist[0]]);

    var canv = poly(
      vtxlist.map(function(x) {
        return [x[0] + xof, x[1] + yof];
      }),
      { fil: col, str: col, wid: out },
    );
    return canv;`,
  `    return emitStroke(ptlist, vtxlist0, vtxlist1, xof, yof, col, out);`,
);

// --- no stray figures / towers unless asked -------------------------------
rep(
  "      var mcnt = randChoice([0, 1, 1, 2]);\n",
  "      var mcnt = randChoice([0, 1, 1, 2]);\n      if (!OPTS.figures) mcnt = 0;\n",
);
rep(
  "      var dir = fli ? -1 : 1;\n      canv += Man.man(",
  "      var dir = fli ? -1 : 1;\n      if (OPTS.figures) canv += Man.man(",
);
rep(
  "          return Arch.transmissionTower01(x + xoff, y + yoff, seed);",
  '          return OPTS.towers ? Arch.transmissionTower01(x + xoff, y + yoff, seed) : "";',
);

// --- per-mountain opt-out of incidental architecture ----------------------
rep(
  "          var tt = randChoice([0, 0, 1, 1, 1, 2]);\n",
  "          var tt = randChoice([0, 0, 1, 1, 1, 2]);\n          if (args.arch === false) tt = 0;\n",
);
rep(
  "          return Arch.arch03(x + xoff, y + yoff, seed, {",
  '          if (args.arch === false) return "";\n          return Arch.arch03(x + xoff, y + yoff, seed, {',
);

// --- distant ranges: coarser wash triangles on request (far fewer ops) -----
rep(
  "          area: 100,\n          convex: true,\n          optimize: false,",
  "          area: args.tri || 100,\n          convex: true,\n          optimize: false,",
);

// --- flat terraces report their plateau so objects can stand on it ---------
rep(
  "      if (grlist1.length == 0) {\n        return canv;\n      }",
  "      if (grlist1.length == 0) {\n        Mount.lastGround = null;\n        return canv;\n      }",
);
rep(
  "      canv += this.flatDec(xoff, yoff, bound(grlist));",
  "      var gb = bound(grlist);\n      Mount.lastGround = {\n        xmin: gb.xmin + xoff,\n        xmax: gb.xmax + xoff,\n        ymin: gb.ymin + yoff,\n        ymax: gb.ymax + yoff,\n      };\n      if (args.dec !== false) canv += this.flatDec(xoff, yoff, gb);",
);

// --- expose private helpers used by objects.js ---------------------------
rep(
  "    this.arch01 = function(xoff, yoff, seed, args) {",
  "    this.box = box;\n    this.deco = deco;\n    this.rail = rail;\n    this.roof = roof;\n    this.pagroof = pagroof;\n    this.hut = hut;\n    this.flip = flip;\n\n    this.arch01 = function(xoff, yoff, seed, args) {",
);
rep(
  "    this.hat01 = function(p0, p1, args) {",
  "    this.expand = expand;\n    this.tranpoly = tranpoly;\n    this.flipper = flipper;\n\n    this.hat01 = function(p0, p1, args) {",
);

const header = `/* eslint-disable */
// @ts-nocheck
/*
 * Ink landscape generator: ported from shan-shui-inf by Lingdong Huang.
 * https://github.com/LingDong-/shan-shui-inf
 *
 * Changes from upstream: extracted into a module; Math.random is a local,
 * seeded shadow (the global is untouched); poly()/stroke() record draw ops
 * and return order-preserving tokens instead of SVG strings; incidental
 * figures, mountain architecture and transmission towers are opt-out/opt-in;
 * flat terraces report their plateau; private Arch/Man helpers are exposed.
 * Generated by scripts/shanshui/port.mjs — don't edit by hand; the body below
 * is upstream code apart from those edits.
 *
${license.split("\n").map((l) => (" * " + l).trimEnd()).join("\n")}
 */

/** Generation switches. */
export const OPTS = { figures: false, towers: false };

/** Draw ops recorded since the last capture(). */
let OPS = [];
const TOKEN = /\\u0001(\\d+)\\u0002/g;

function token(op) {
  OPS.push(op);
  return "\\u0001" + (OPS.length - 1) + "\\u0002";
}

function finite(p) {
  return Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

function emitPoly(plist, xof, yof, fil, str, wid) {
  const pts = [];
  for (let i = 0; i < plist.length; i++) {
    const p = plist[i];
    if (p && finite(p)) pts.push(p[0] + xof, p[1] + yof);
  }
  if (pts.length < 4) return "";
  return token({ k: "p", pts, fil, str, wid });
}

function emitStroke(ptlist, side0, side1, xof, yof, col, out) {
  const first = ptlist[0];
  const last = ptlist[ptlist.length - 1];
  const a = [first].concat(side0, [last]);
  const b = [first].concat(side1, [last]);
  const l = [];
  const r = [];
  for (let i = 0; i < a.length; i++) {
    if (!a[i] || !b[i] || !finite(a[i]) || !finite(b[i])) continue;
    l.push(a[i][0] + xof, a[i][1] + yof);
    r.push(b[i][0] + xof, b[i][1] + yof);
  }
  if (l.length < 4) return "";
  return token({ k: "s", l, r, col, out });
}

/** Records a non-upstream op (e.g. a mist band) and returns its token. */
export function emitOp(op) {
  return token(op);
}

/**
 * Runs fn (which returns an upstream-style canvas string) and returns the ops
 * its output references, in painter's order.
 */
export function capture(fn) {
  OPS = [];
  const canv = fn() || "";
  const ops = [];
  for (const m of String(canv).matchAll(TOKEN)) ops.push(OPS[+m[1]]);
  OPS = [];
  return ops;
}

/** Re-seeds the PRNG (strings or numbers, as upstream). */
export function seed(x) {
  Prng.seed(x);
  Noise.reset();
}

/** The seeded PRNG upstream installs as Math.random. */
export function random() {
  return Prng.next();
}

const Math = Object.create(globalThis.Math);
Math.random = function() {
  return Prng.next();
};
Math.seed = function(x) {
  return Prng.seed(x);
};

`;

const footer = `

export {
  Prng,
  Noise,
  PolyTools,
  poly,
  stroke,
  blob,
  div,
  texture,
  Tree,
  Mount,
  Arch,
  Man,
  water,
  bezmh,
  distance,
  mapval,
  loopNoise,
  randChoice,
  normRand,
  wtrand,
  randGaussian,
};
`;

writeFileSync(outPath, header + body + footer);
console.log("wrote", outPath, (header + body + footer).length, "chars");
