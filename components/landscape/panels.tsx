import { ABOUT } from "@/content/about";
import { AE_TITLE, type AeProject } from "@/content/after-effects";
import { LINKS, LINKS_TITLE } from "@/content/links";
import { NOTHING_PLAYING, NOW_PLAYING_TITLE, SPOTIFY_PROFILE } from "@/content/presence";
import { PROJECTS, PROJECTS_TITLE } from "@/content/projects";
import type { SpotifyPresence } from "@/lib/presence/types";
import AeProjectCard from "./AeProjectCard";
import { LINK_ICONS } from "./LinkIcons";

const HEADING = "font-ink mb-6 pr-10 text-3xl font-medium tracking-wide text-[#2f2c27]";

export function AboutPanel({ titleId }: { titleId: string }) {
  return (
    <>
      <h2 id={titleId} className={HEADING}>
        {ABOUT.title}
      </h2>
      <div className="font-ink space-y-4 text-lg leading-relaxed text-[#3d3a34]">
        {ABOUT.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </>
  );
}

export function LinksPanel({ titleId }: { titleId: string }) {
  return (
    <>
      <h2 id={titleId} className={HEADING}>
        {LINKS_TITLE}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {LINKS.map(({ label, handle, href, icon }) => {
          const Icon = LINK_ICONS[icon];
          return (
            <li key={href}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="ink-focus group flex items-center gap-3 rounded-md border border-[#2f2c27]/20 px-3 py-2 transition-colors hover:border-[#2f2c27]/50 hover:bg-[#fbf5e8]/60"
              >
                <Icon />
                <span className="font-ink leading-tight">
                  <span className="block text-lg text-[#2f2c27]">{label}</span>
                  <span className="block text-sm text-[#6b665c]">{handle}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function ProjectsPanel({ titleId, aeProjects }: { titleId: string; aeProjects: AeProject[] }) {
  return (
    <>
      <h2 id={titleId} className={HEADING}>
        {PROJECTS_TITLE}
      </h2>
      <ul className="font-ink divide-y divide-[#c9b896]/70">
        {PROJECTS.map((p, i) => (
          <li key={i} className="py-4 first:pt-0 last:pb-0">
            <h3 className="text-xl font-medium text-[#2f2c27]">
              {p.href ? (
                <a href={p.href} target="_blank" rel="noreferrer" className="ink-focus underline decoration-[#b23a2c]/50 underline-offset-4 hover:decoration-[#b23a2c]">
                  {p.title}
                </a>
              ) : (
                p.title
              )}
            </h3>
            <p className="mt-1 text-lg leading-relaxed text-[#4a463f]">{p.description}</p>
            {p.tags && (
              <p className="mt-2 text-sm uppercase tracking-[0.18em] text-[#8a8478]">{p.tags.join(" · ")}</p>
            )}
          </li>
        ))}
      </ul>
      {aeProjects.length > 0 && (
        <section className="mt-8">
          <h3 className="font-ink border-b border-[#c9b896]/70 pb-2 text-sm uppercase tracking-[0.22em] text-[#8a8478]">{AE_TITLE}</h3>
          <ul className="divide-y divide-[#c9b896]/70">
            {aeProjects.map((p) => (
              <li key={p.slug} className="py-5 last:pb-0">
                <AeProjectCard title={p.title} info={p.info} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function RecordPanel({ titleId, spotify }: { titleId: string; spotify: SpotifyPresence | null }) {
  const track = spotify?.track ? spotify : null;
  return (
    <>
      <h2 id={titleId} className={HEADING}>
        {NOW_PLAYING_TITLE}
      </h2>
      {track ? (
        <div className="flex items-center gap-5">
          {track.albumArt && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.albumArt}
              alt={track.album ? `Album art for ${track.album}` : "Album art"}
              className="h-24 w-24 shrink-0 rounded-[3px] object-cover sm:h-28 sm:w-28"
              style={{ boxShadow: "0 0 0 1px rgba(120, 92, 54, 0.35), 0 6px 14px -8px rgba(40, 28, 14, 0.5)" }}
            />
          )}
          <div className="font-ink min-w-0">
            <p className="text-2xl leading-tight text-[#2f2c27]">
              {track.trackUrl ? (
                <a
                  href={track.trackUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ink-focus underline decoration-[#b23a2c]/50 underline-offset-4 hover:decoration-[#b23a2c]"
                >
                  {track.track}
                </a>
              ) : (
                track.track
              )}
            </p>
            {track.artist && <p className="mt-1 text-lg text-[#4a463f]">{track.artist}</p>}
            {track.album && <p className="text-base italic text-[#6b665c]">{track.album}</p>}
            {!track.isPlaying && <p className="mt-2 text-sm uppercase tracking-[0.2em] text-[#8a8478]">paused</p>}
          </div>
        </div>
      ) : (
        <p className="font-ink text-lg leading-relaxed text-[#3d3a34]">{NOTHING_PLAYING}</p>
      )}
      {SPOTIFY_PROFILE && (
        <p className="font-ink mt-6 text-lg">
          <a
            href={SPOTIFY_PROFILE}
            target="_blank"
            rel="noreferrer"
            className="ink-focus text-[#4a463f] underline decoration-[#b23a2c]/50 underline-offset-4 hover:decoration-[#b23a2c]"
          >
            My Spotify profile
          </a>
        </p>
      )}
    </>
  );
}
