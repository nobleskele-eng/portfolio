/// <reference lib="webworker" />
/*
 * Generates the landscape off the main thread and streams it back part by
 * part (back-to-front), so drawing can start before generation finishes.
 * The engine's seeded Math.random shadow lives in this worker only.
 */
import { paperTile, sceneParts, worldInfo } from "./build.js";
import type { Op, ScenePart, WorkerMessage, WorkerRequest } from "./types";

declare const self: DedicatedWorkerGlobalScope;

let paperSent = false;

function pack(ops: Op[], transfer: Transferable[]): Op[] {
  return ops.map((op) => {
    if (op.k === "s") {
      const l = Float32Array.from(op.l);
      const r = Float32Array.from(op.r);
      transfer.push(l.buffer, r.buffer);
      return { ...op, l, r };
    }
    const pts = Float32Array.from(op.pts);
    transfer.push(pts.buffer);
    return { ...op, pts };
  });
}

function packPart(part: ScenePart, transfer: Transferable[]): ScenePart {
  if (part.kind === "group") {
    const frames = part.frames?.map((ops) => pack(ops, transfer));
    return { ...part, ops: frames ? frames[0] : pack(part.ops, transfer), frames };
  }
  if (part.kind === "object") return { ...part, ops: pack(part.ops, transfer) };
  if (part.kind === "record") {
    const frames: Record<string, Op[]> = {};
    for (const key of Object.keys(part.frames)) frames[key] = pack(part.frames[key], transfer);
    return { ...part, frames };
  }
  const frames = {} as typeof part.frames;
  for (const pose of Object.keys(part.frames) as (keyof typeof part.frames)[]) {
    frames[pose] = {};
    for (const key of Object.keys(part.frames[pose])) {
      frames[pose][key] = pack(part.frames[pose][key], transfer);
    }
  }
  return { ...part, frames };
}

function post(msg: WorkerMessage, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer);
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { layout, seed } = e.data;
  post({ type: "world", layout, world: worldInfo(layout) });

  if (!paperSent) {
    paperSent = true;
    const size = 512;
    const data = paperTile(seed, size) as Uint8ClampedArray;
    post({ type: "paper", size, data }, [data.buffer]);
  }

  const parts = sceneParts(layout, seed) as Iterator<ScenePart>;
  for (let next = parts.next(); !next.done; next = parts.next()) {
    const transfer: Transferable[] = [];
    post({ type: "part", layout, part: packPart(next.value, transfer) }, transfer);
  }
  post({ type: "done", layout });
};
