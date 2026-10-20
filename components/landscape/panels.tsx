import { useMemo, useRef } from "react";
import { ABOUT } from "@/content/about";
import type { AeProject } from "@/content/after-effects";
import { LINKS, LINKS_TITLE } from "@/content/links";
import {
  CLAUDE_DARK,
  CLAUDE_HOOK_SOURCE,
  CLAUDE_STATE,
  CLAUDE_TITLE,
  NOTHING_PLAYING,
  NOW_PLAYING_TITLE,
  SPOTIFY_PROFILE,
} from "@/content/presence";
import type { ShelfId } from "@/content/projects";
import { PERIOD_LABEL, SKY_TITLE } from "@/content/sky";
import { ago } from "@/lib/clock";
import type { AgentPresence, SpotifyPresence } from "@/lib/presence/types";
import { phaseName, sunTimes, torontoClock, torontoDay, type SkyState } from "@/lib/sky";
import Album from "./Album";
import Bookshelf from "./Bookshelf";
import { HEADING } from "./heading";
import { LINK_ICONS } from "./LinkIcons";
import { SkyGlyph } from "./SkyGlyph";

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

/** Claude's spark as a seal: eight tapered rays, long and a little shorter in turn. */
function SparkSeal({ status }: { status: AgentPresence["status"] }) {
  const rays = Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4 - Math.PI / 2;
    const len = k % 2 ? 24 : 31;
    const w = k % 2 ? 3.4 : 4;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    // a thin kite from the centre out to the tip
    return `M${-s * w} ${c * w} L${c * len} ${s * len} L${s * w} ${-c * w} Z`;
  });
  const lit = status === "active";
  return (
    <span
      aria-hidden
      className="grid h-24 w-24 shrink-0 place-items-center rounded-[4px] sm:h-28 sm:w-28"
      style={{
        background: status === "offline" ? "rgba(47, 44, 39, 0.08)" : "rgba(178, 58, 44, 0.08)",
        boxShadow: "inset 0 0 0 1.5px rgba(178, 58, 44, 0.35)",
      }}
    >
      <svg viewBox="-36 -36 72 72" className={`h-16 w-16 sm:h-20 sm:w-20 ${lit ? "claude-spark" : ""}`}>
        <g fill={status === "offline" ? "rgba(47, 44, 39, 0.3)" : "var(--seal)"} opacity={status === "idle" ? 0.5 : 1}>
          {rays.map((d, i) => (
            <path key={i} d={d} />
          ))}
          <circle r="5" />
        </g>
      </svg>
    </span>
  );
}

/** The lantern: what Claude Code is doing right now, and how it gets here. */
export function ClaudePanel({ titleId, claude }: { titleId: string; claude: AgentPresence | null }) {
  const status = claude?.status ?? "offline";
  const awake = status !== "offline";
  return (
    <>
      <h2 id={titleId} className={HEADING}>
        {CLAUDE_TITLE}
      </h2>
      <div className="flex items-center gap-5">
        <SparkSeal status={status} />
        <div className="font-ink min-w-0">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8a8478]">
            {CLAUDE_STATE[status]}
            {claude?.updatedAt ? ` · ${awake ? "" : "last lit "}${ago(claude.updatedAt)}` : ""}
          </p>
          {awake ? (
            <>
              <p className="mt-1 text-2xl leading-tight text-[#2f2c27]">{claude?.detail ?? "Working"}</p>
              {claude?.project && (
                <p className="mt-1 text-lg text-[#4a463f]">
                  in <span className="italic">{claude.project}</span>
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-lg leading-relaxed text-[#3d3a34]">{CLAUDE_DARK}</p>
          )}
        </div>
      </div>
      {CLAUDE_HOOK_SOURCE && (
        <p className="font-ink mt-6 text-lg">
          <a
            href={CLAUDE_HOOK_SOURCE}
            target="_blank"
            rel="noreferrer"
            className="ink-focus text-[#4a463f] underline decoration-[#b23a2c]/50 underline-offset-4 hover:decoration-[#b23a2c]"
          >
            The hook that lights it
          </a>
        </p>
      )}
    </>
  );
}

/** Toronto's sky: the time there, the day's sunrise and sunset, the moon. */
export function SkyPanel({ titleId, sky }: { titleId: string; sky: SkyState | null }) {
  // the day's sunrise and sunset only change with the day
  const day = sky ? torontoDay(sky.at) : "";
  const times = useMemo(() => (sky ? sunTimes(sky.at) : null), [day]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sky) return null;
  const sunUp = sky.sun.alt > -3;
  return (
    <>
      <h2 id={titleId} className={HEADING}>
        {SKY_TITLE(sky.clock)}
      </h2>
      <div className="flex items-center gap-5">
        <span
          aria-hidden
          className="grid h-24 w-24 shrink-0 place-items-center rounded-[4px] sm:h-28 sm:w-28"
          style={{
            background: sunUp ? "rgba(178, 58, 44, 0.08)" : "rgba(30, 45, 100, 0.1)",
            boxShadow: `inset 0 0 0 1.5px ${sunUp ? "rgba(178, 58, 44, 0.35)" : "rgba(30, 45, 100, 0.3)"}`,
          }}
        >
          <SkyGlyph sky={sky} size={76} color={sunUp ? "var(--seal)" : "#3a4566"} />
        </span>
        <div className="font-ink min-w-0">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8a8478]">{day}</p>
          <p className="mt-1 text-2xl capitalize leading-tight text-[#2f2c27]">{PERIOD_LABEL[sky.period]}</p>
          {times && (times.rise || times.set) && (
            <p className="mt-1 text-lg text-[#4a463f]">
              {times.rise && <>sunrise {torontoClock(times.rise)}</>}
              {times.rise && times.set && " · "}
              {times.set && <>sunset {torontoClock(times.set)}</>}
            </p>
          )}
          <p className="text-base italic text-[#6b665c]">
            {phaseName(sky.moon.phase)}, {Math.round(sky.moon.lit * 100)}% lit
          </p>
        </div>
      </div>
    </>
  );
}
