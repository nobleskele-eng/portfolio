/** Flat [x0, y0, x1, y1, …] world coordinates. */
export type Pts = Float32Array | number[];

/** A filled and/or stroked polyline (upstream's poly()). */
export interface PolyOp {
  k: "p";
  pts: Pts;
  fil: string;
  str: string;
  wid: number;
}

/** A brush stroke (upstream's stroke()): two sides that meet at both ends. */
export interface StrokeOp {
  k: "s";
  l: Pts;
  r: Pts;
  col: string;
  out: number;
}

/**
 * A mist band: a polygon filled with paper-white whose opacity follows a
 * vertical gradient from y0 to y1. `stops` is [offset, alpha, offset, alpha…].
 */
export interface FogOp {
  k: "f";
  pts: Pts;
  y0: number;
  y1: number;
  stops: number[];
}

export type Op = PolyOp | StrokeOp | FogOp;

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Layout = "wide" | "tall";
export type Pose = "wave" | "sit" | "sleep";
export type ObjectId = "shelf" | "board" | "chair";
/** What a visitor can click: the person (with their chair), board, shelf, record player, lantern. */
export type HotspotId = "person" | "board" | "shelf" | "record" | "claude";
/** What can open a scroll: the hotspots, and the sky's inscription (Toronto's time). */
export type PanelId = HotspotId | "sky";
/** The lantern (Claude Code): lit while working, an ember while idle, dark when offline. */
export type Lamp = "lit" | "idle" | "off";

/**
 * Depth planes, back to front. Each is baked into its own bitmap and moves at
 * its own rate when the camera zooms (parallax).
 */
export type PlaneId = "sky" | "clouds" | "far" | "water" | "mid" | "near";
// The lake sits behind the mid mountains: their flanks hide the far water and
// only the water below their bases shows in front of them.
export const PLANES: PlaneId[] = ["sky", "clouds", "far", "water", "mid", "near"];

export interface GroupPart {
  kind: "group";
  id: string;
  plane: PlaneId;
  t0: number;
  t1: number;
  ops: Op[];
  /** an animated element (the lake): every drawing, frames[0] === ops */
  frames?: Op[][];
  /** mirror this element in the lake about this waterline (world y) */
  reflect?: number;
}

export interface ObjectPart {
  kind: "object";
  id: ObjectId;
  t0: number;
  t1: number;
  ops: Op[];
  bbox: BBox;
}

export interface RecordPart {
  kind: "record";
  t0: number;
  t1: number;
  /** "stop" plus "spin0"…"spinN" */
  frames: Record<string, Op[]>;
}

export interface LanternPart {
  kind: "lantern";
  t0: number;
  t1: number;
  /** "off", "idle" plus "lit0"…"litN" */
  frames: Record<string, Op[]>;
}

export interface PersonPart {
  kind: "person";
  t0: number;
  t1: number;
  /** frames[pose][key] */
  frames: Record<Pose, Record<string, Op[]>>;
}

export type ScenePart = GroupPart | ObjectPart | RecordPart | LanternPart | PersonPart;

/** The lake's surface: a closed polygon (far shoreline, then the frame's bottom). */
export interface LakeInfo {
  poly: number[];
  horizon: number;
  bottom: number;
}

export interface WorldInfo {
  w: number;
  h: number;
  minH: number;
  /** world region each plane's bitmap covers */
  planes: Record<PlaneId, BBox>;
  /** what the scroll zoom ends on */
  focus: BBox;
  lake: LakeInfo;
  /** clouds wrap horizontally with this period (world units) */
  cloudTile: number;
}

export type WorkerRequest = { type: "build"; layout: Layout; seed?: string };

export type WorkerMessage =
  | { type: "world"; layout: Layout; world: WorldInfo }
  | { type: "paper"; size: number; data: Uint8ClampedArray }
  | { type: "part"; layout: Layout; part: ScenePart }
  | { type: "done"; layout: Layout };
