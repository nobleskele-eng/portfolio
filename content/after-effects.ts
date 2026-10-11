// After Effects projects on the bookshelf. Run
// scripts/after-effects/export-project-info.jsx in After Effects and save its
// JSON into content/after-effects/; every file there shows up as a card. Re-run
// it after editing a project to refresh the numbers.

export const AE_TITLE = "After Effects";

// Card titles by JSON file name (without .json), in display order. Files not
// listed here still show, titled by their file name.
export const AE_TITLES: Record<string, string> = {
  wspbae: "wspbae",
  iwontsaygoodbye: "i wont say goodbye",
  moneyallaroundme: "money all around me",
};

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
  title: string;
  info: AeProjectInfo;
}
