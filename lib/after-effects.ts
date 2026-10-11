import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AE_TITLES, type AeProject, type AeProjectInfo } from "@/content/after-effects";

const DIR = join(process.cwd(), "content", "after-effects");

/** Every exported project in content/after-effects/, listed ones first in AE_TITLES order. */
export function loadAeProjects(): AeProject[] {
  let files: string[] = [];
  try {
    files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const order = Object.keys(AE_TITLES);
  const rank = (slug: string) => (order.includes(slug) ? order.indexOf(slug) : order.length);
  return files
    .map((f) => {
      const slug = f.replace(/\.json$/, "");
      const info = JSON.parse(readFileSync(join(DIR, f), "utf8")) as AeProjectInfo;
      return { slug, title: AE_TITLES[slug] ?? slug, info };
    })
    .sort((a, b) => rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));
}
