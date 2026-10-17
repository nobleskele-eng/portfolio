// After Effects exports shown under works on the bookshelf. Run
// scripts/after-effects/export-project-info.jsx in After Effects, save its
// JSON into content/after-effects/, and set a work's `ae` in
// content/projects.ts to the file name (without .json). Re-run it after
// editing a project to refresh the numbers.

export const AE_TITLE = "How it's built";

export interface AeLayer {
  name: string;
  kind: string;
  in: number;
  out: number;
  enabled: boolean;
  keyframes: number;
  expressions: number;
  effects: string[];
}

export interface AeProjectInfo {
  file: string;
  aeVersion: string;
  counts: {
    comps: number;
    layers: number;
    keyframes: number;
    expressions: number;
    effects: number;
  };
  main: {
    comp: string;
    width: number;
    height: number;
    fps: number;
    duration: number;
    totalLayers: number;
    layers: AeLayer[];
  } | null;
  effects: { name: string; matchName: string; category: string; count: number }[];
  fonts: { family: string; style: string; count: number }[];
}

export interface AeProject {
  slug: string;
  info: AeProjectInfo;
}
