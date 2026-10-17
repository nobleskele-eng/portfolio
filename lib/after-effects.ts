import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AeProject, AeProjectInfo } from "@/content/after-effects";
import { WORKS } from "@/content/projects";

const DIR = join(process.cwd(), "content", "after-effects");

/** The exports in content/after-effects/ that a work on the bookshelf points at. */
export function loadAeProjects(): AeProject[] {
  let files: string[] = [];
  try {
    files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const used = new Set(WORKS.map((w) => w.ae));
  return files
    .map((f) => f.replace(/\.json$/, ""))
    .filter((slug) => used.has(slug))
    .map((slug) => ({
      slug,
      info: JSON.parse(readFileSync(join(DIR, `${slug}.json`), "utf8")) as AeProjectInfo,
    }));
}
