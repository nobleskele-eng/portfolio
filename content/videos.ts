// Videos the works on the bookshelf play, by key. content/videos.json is
// written by scripts/videos/ingest.mjs: add an entry with the Drive file's
// `drive` id and `bytes`, run the script, and it fills in the rest.
import data from "./videos.json";

export interface VideoSource {
  src: string;
  type: string;
}

export interface Video {
  /** Google Drive file id the original came from */
  drive?: string;
  bytes?: number;
  /** seconds in for the poster frame */
  posterAt?: number;
  sources?: VideoSource[];
  poster?: string;
  width?: number;
  height?: number;
  duration?: number;
}

/** A video that's been ingested and can play. */
export type ReadyVideo = Required<Pick<Video, "sources" | "poster" | "width" | "height" | "duration">>;

const VIDEOS = data as Record<string, Video>;

export function readyVideo(key: string | undefined): ReadyVideo | null {
  const v = key ? VIDEOS[key] : undefined;
  if (!v?.sources?.length || !v.poster || !v.width || !v.height || !v.duration) return null;
  return { sources: v.sources, poster: v.poster, width: v.width, height: v.height, duration: v.duration };
}
