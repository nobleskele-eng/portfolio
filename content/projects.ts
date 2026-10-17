// On the bookshelf: four volumes, each a book of works paged through one
// spread at a time. A work's `video` is its key in content/videos.json (run
// scripts/videos/ingest.mjs to fill one in), and `ae` names an After Effects
// export in content/after-effects/ to show under it.
export const PROJECTS_TITLE = "Projects";
export const SHELF_HINT = "pick a volume";
export const NO_VIDEO_YET = "The video for this one is on the way.";

export type ShelfId = "vfx" | "mograph" | "animation" | "coding";

// `note` sits under the volume's title when it's open.
export const SHELVES: { id: ShelfId; title: string; note?: string }[] = [
  { id: "vfx", title: "VFX" },
  { id: "mograph", title: "Motion Graphics" },
  { id: "animation", title: "Animation", note: "A couple more in the works." },
  { id: "coding", title: "Coding" },
];

export interface Work {
  slug: string;
  shelf: ShelfId;
  title: string;
  /** a style within the volume, e.g. a vibe or a jugg edit */
  group?: string;
  year?: string;
  note?: string;
  tools?: string[];
  video?: string;
  href?: string;
  ae?: string;
}

// In display order within each volume; a volume opens on its first.
export const WORKS: Work[] = [
  { slug: "memories", shelf: "vfx", group: "Vibe", title: "Memories <3", video: "memories" },
  { slug: "look-in-my-eyes", shelf: "vfx", group: "Vibe", title: "Look in my eyes", video: "look-in-my-eyes" },
  { slug: "original", shelf: "vfx", group: "Vibe", title: "Original", video: "original" },
  { slug: "wearenotplaying", shelf: "vfx", group: "Jugg", title: "WEARENOTPLAYING", video: "wearenotplaying" },
  { slug: "dontplaybytharules", shelf: "vfx", group: "Jugg", title: "DONTPLAYBYTHARULES", video: "dontplaybytharules" },

  { slug: "imyeat", shelf: "mograph", title: "IMYEAT", video: "imyeat" },
  { slug: "stay", shelf: "mograph", title: "STAY", video: "stay" },

  { slug: "bae", shelf: "animation", title: "BAE", video: "bae" },

  {
    slug: "stanza",
    shelf: "coding",
    title: "Stanza",
    note: "A themeable desktop mini player for Spotify and SoundCloud, built typography-first: the UI is carried by type and motion, not album art.",
    tools: ["Tauri", "TypeScript", "Windows & macOS"],
    href: "https://github.com/nobleskele-eng/Stanza-dev",
  },
];
