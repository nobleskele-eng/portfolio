import { useRef } from "react";
import { ABOUT } from "@/content/about";
import type { AeProject } from "@/content/after-effects";
import { LINKS, LINKS_TITLE } from "@/content/links";
import { NOTHING_PLAYING, NOW_PLAYING_TITLE, SPOTIFY_PROFILE } from "@/content/presence";
import type { ShelfId } from "@/content/projects";
import type { SpotifyPresence } from "@/lib/presence/types";
import Album from "./Album";
import Bookshelf from "./Bookshelf";
import { HEADING } from "./heading";
import { LINK_ICONS } from "./LinkIcons";

/** A volume open on the bookshelf, at a page. */
export type OpenBook = { shelf: ShelfId; index: number };

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

/** The bookshelf: the four volumes, or one of them open as an album. */
export function ProjectsPanel({
  titleId,
  aeProjects,
  book,
  vertical,
  onBook,
}: {
  titleId: string;
  aeProjects: AeProject[];
  book: OpenBook | null;
  vertical: boolean;
  onBook: (book: OpenBook | null) => void;
}) {
  // which volume was last open, so its spine gets focus back
  const last = useRef<ShelfId | null>(null);
  if (book) last.current = book.shelf;
  return book ? (
    <Album
      titleId={titleId}
      shelf={book.shelf}
      index={book.index}
      vertical={vertical}
      aeProjects={aeProjects}
      onIndex={(index) => onBook({ ...book, index })}
      onBack={() => onBook(null)}
    />
  ) : (
    <Bookshelf titleId={titleId} focusShelf={last.current} onPick={(shelf) => onBook({ shelf, index: 0 })} />
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
