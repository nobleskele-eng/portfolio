"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { PresenceSnapshot } from "@/lib/presence/types";

// How often to re-fetch the presence snapshot, in ms.
const POLL_INTERVAL_MS = 30_000;

function usePresence() {
  const [data, setData] = useState<PresenceSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/presence", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const snapshot = (await res.json()) as PresenceSnapshot;
        if (!cancelled) {
          setData(snapshot);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { data, error };
}

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex min-h-[160px] flex-col gap-2 rounded-xl border border-dashed border-neutral-400 p-6 text-sm">
      <span className="placeholder-label">{title}</span>
      {children}
    </li>
  );
}

// Ink colour for the hand-drawn Spotify card — a touch warmer than pure black.
const SKETCH_INK = "#111";
const HAND = "'Caveat', ui-sans-serif, cursive";
const SCRAWL = "'Kalam', ui-sans-serif, cursive";

/** Wobble filters + hatch pattern, shared by every stroke on the card. */
function SketchDefs() {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <defs>
        <filter
          id="sketch-wobble"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.09"
            numOctaves={2}
            seed={7}
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={3.2} />
        </filter>
        <filter
          id="sketch-wobble-tight"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03 0.2"
            numOctaves={2}
            seed={3}
            result="n2"
          />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale={1.6} />
        </filter>
        <pattern
          id="sketch-hatch"
          width={6}
          height={6}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={6} stroke={SKETCH_INK} strokeWidth={1} />
        </pattern>
      </defs>
    </svg>
  );
}

/** The spinning sketched record, with an album-art chip clipped to its corner. */
function SketchDisc({
  isPlaying,
  albumArt,
  album,
}: {
  isPlaying: boolean;
  albumArt: string | null;
  album: string | null;
}) {
  return (
    <div className="relative h-[76px] w-[76px] flex-none">
      <svg
        width="76"
        height="76"
        viewBox="0 0 76 76"
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        {isPlaying ? (
          <g
            className="sketch-disc__streaks"
            opacity={0.35}
            style={{
              animation: "sketch-streak-fade 1.4s ease-in-out infinite",
            }}
          >
            <line x1="66" y1="14" x2="74" y2="8" stroke={SKETCH_INK} strokeWidth="1.5" filter="url(#sketch-wobble-tight)" />
            <line x1="70" y1="26" x2="79" y2="23" stroke={SKETCH_INK} strokeWidth="1.5" filter="url(#sketch-wobble-tight)" />
            <line x1="70" y1="50" x2="79" y2="54" stroke={SKETCH_INK} strokeWidth="1.5" filter="url(#sketch-wobble-tight)" />
          </g>
        ) : null}

        <g
          className="sketch-disc__spin"
          style={{
            transformOrigin: "38px 38px",
            animation: "sketch-spin 3.2s linear infinite",
            animationPlayState: isPlaying ? "running" : "paused",
          }}
        >
          <clipPath id="sketch-disc-clip">
            <circle cx="38" cy="38" r="30" />
          </clipPath>
          <rect x="38" y="24" width="24" height="28" fill="url(#sketch-hatch)" opacity="0.55" clipPath="url(#sketch-disc-clip)" filter="url(#sketch-wobble-tight)" />
          <circle cx="38" cy="38" r="30" fill="none" stroke={SKETCH_INK} strokeWidth="2" filter="url(#sketch-wobble)" />
          <circle cx="38" cy="38" r="29" fill="none" stroke={SKETCH_INK} strokeWidth="1" opacity="0.5" filter="url(#sketch-wobble)" />
          <circle cx="38" cy="38" r="22" fill="none" stroke={SKETCH_INK} strokeWidth="1" filter="url(#sketch-wobble-tight)" />
          <circle cx="38" cy="38" r="16" fill="none" stroke={SKETCH_INK} strokeWidth="1" filter="url(#sketch-wobble-tight)" />
          <circle cx="38" cy="38" r="8" fill="url(#sketch-hatch)" stroke={SKETCH_INK} strokeWidth="1.5" filter="url(#sketch-wobble-tight)" />
          <circle cx="38" cy="38" r="1.8" fill={SKETCH_INK} />
        </g>
      </svg>

      <div
        className="absolute -bottom-2 -right-2 h-7 w-7 overflow-hidden border-2 bg-white"
        style={{
          borderColor: SKETCH_INK,
          transform: "rotate(-5deg)",
          boxShadow: "2px 2px 0 rgba(17,17,17,0.15)",
        }}
      >
        {albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={albumArt}
            alt={album ?? ""}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
    </div>
  );
}

function SpotifyCard({ data }: { data: PresenceSnapshot | null }) {
  const spotify = data?.spotify;
  const offline = !spotify || spotify.status === "offline";
  const isPlaying = !offline && spotify.isPlaying;

  const track = offline ? "Nothing playing" : spotify.track ?? "Unknown track";
  const artist = offline ? null : spotify.artist;
  const statusLabel = offline ? "Offline" : isPlaying ? "Playing" : "Paused";

  const trackNode =
    !offline && spotify.trackUrl ? (
      <a
        href={spotify.trackUrl}
        target="_blank"
        rel="noreferrer"
        className="hover:opacity-70"
      >
        {track}
      </a>
    ) : (
      track
    );

  return (
    <li
      className="relative min-h-[160px]"
      style={{ fontFamily: SCRAWL, color: SKETCH_INK }}
    >
      <SketchDefs />

      {/* hand-drawn double border */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ filter: "url(#sketch-wobble)" }}
      >
        <div
          className="absolute inset-0 rounded-[10px] border-2"
          style={{ borderColor: SKETCH_INK }}
        />
        <div
          className="absolute inset-[3px] rounded-[9px] border"
          style={{ borderColor: SKETCH_INK, opacity: 0.5 }}
        />
      </div>

      <div className="relative flex h-full flex-col justify-center gap-3.5 p-5">
        <div
          style={{ fontFamily: HAND, fontWeight: 700, letterSpacing: "0.14em" }}
          className="text-[15px]"
        >
          S P O T I F Y
        </div>

        <div className="flex items-center gap-4">
          <SketchDisc
            isPlaying={isPlaying}
            albumArt={offline ? null : spotify.albumArt}
            album={offline ? null : spotify.album}
          />

          <div className="min-w-0 flex-1">
            <div
              className="truncate"
              style={{
                fontFamily: HAND,
                fontWeight: 700,
                fontSize: "23px",
                lineHeight: 1.15,
                textDecoration: "underline",
                textDecorationThickness: "1.5px",
              }}
              title={track}
            >
              {trackNode}
            </div>
            {artist ? (
              <div
                className="truncate"
                style={{
                  fontFamily: HAND,
                  fontWeight: 500,
                  fontSize: "17px",
                  lineHeight: 1.3,
                  opacity: 0.75,
                }}
                title={artist}
              >
                {artist}
              </div>
            ) : null}
            <div
              className="mt-1 text-[12px] italic"
              style={{ opacity: 0.45 }}
            >
              {statusLabel}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

const DISCORD_STATUS: Record<
  string,
  { label: string; color: string }
> = {
  online: { label: "Online", color: "#23a55a" },
  idle: { label: "Idle", color: "#f0b232" },
  dnd: { label: "Do Not Disturb", color: "#f23f43" },
  offline: { label: "Offline", color: "#80848e" },
};

/** Sketched avatar circle — real profile picture when available — with a
 *  hand-drawn status dot punched into its corner. */
function SketchAvatar({
  dotColor,
  offline,
  avatarUrl,
  displayName,
}: {
  dotColor: string;
  offline: boolean;
  avatarUrl: string | null;
  displayName: string | null;
}) {
  return (
    <div className="relative h-[76px] w-[76px] flex-none">
      {avatarUrl ? (
        <div
          className="absolute overflow-hidden rounded-full"
          style={{
            top: 4,
            left: 4,
            width: 60,
            height: 60,
            filter: offline ? "grayscale(1)" : undefined,
            opacity: offline ? 0.55 : 1,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt={displayName ?? "Discord avatar"}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <svg
        width="76"
        height="76"
        viewBox="0 0 76 76"
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        {!avatarUrl ? (
          <circle
            cx="34"
            cy="34"
            r="30"
            fill="url(#sketch-hatch)"
            opacity={0.35}
            stroke={SKETCH_INK}
            strokeWidth="2"
            filter="url(#sketch-wobble)"
          />
        ) : null}
        <circle
          cx="34"
          cy="34"
          r="30"
          fill="none"
          stroke={SKETCH_INK}
          strokeWidth="2"
          filter="url(#sketch-wobble)"
        />
        <circle
          cx="34"
          cy="34"
          r="29"
          fill="none"
          stroke={SKETCH_INK}
          strokeWidth="1"
          opacity={0.5}
          filter="url(#sketch-wobble)"
        />

        {/* status dot, punched out of the avatar with a white ring */}
        <circle cx="58" cy="58" r="12" fill="white" />
        <circle
          cx="58"
          cy="58"
          r="9"
          fill={offline ? "url(#sketch-hatch)" : dotColor}
          stroke={SKETCH_INK}
          strokeWidth="1.6"
          filter="url(#sketch-wobble-tight)"
        />
      </svg>
    </div>
  );
}

function DiscordCard({ data }: { data: PresenceSnapshot | null }) {
  const discord = data?.discord;
  const raw = discord?.discordStatus ?? "offline";
  const offline = !discord || discord.status === "offline";
  const entry = DISCORD_STATUS[raw] ?? DISCORD_STATUS.offline;

  const activity = discord?.activity ?? null;
  const name = discord?.displayName ?? entry.label;

  return (
    <li
      className="relative min-h-[160px]"
      style={{ fontFamily: SCRAWL, color: SKETCH_INK }}
    >
      <SketchDefs />

      {/* hand-drawn double border */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ filter: "url(#sketch-wobble)" }}
      >
        <div
          className="absolute inset-0 rounded-[10px] border-2"
          style={{ borderColor: SKETCH_INK }}
        />
        <div
          className="absolute inset-[3px] rounded-[9px] border"
          style={{ borderColor: SKETCH_INK, opacity: 0.5 }}
        />
      </div>

      <div className="relative flex h-full flex-col gap-3.5 p-5">
        <div
          style={{ fontFamily: HAND, fontWeight: 700, letterSpacing: "0.14em" }}
          className="text-[15px]"
        >
          D I S C O R D
        </div>

        <div className="flex items-center gap-4">
          <SketchAvatar
            dotColor={entry.color}
            offline={offline}
            avatarUrl={discord?.avatarUrl ?? null}
            displayName={discord?.displayName ?? null}
          />

          <div className="min-w-0 flex-1">
            <div
              className="truncate"
              style={{
                fontFamily: HAND,
                fontWeight: 700,
                fontSize: "23px",
                lineHeight: 1.15,
              }}
              title={name}
            >
              {name}
            </div>
            <div
              className="mt-1 truncate text-[14px]"
              style={{ opacity: activity ? 0.75 : 0.4 }}
              title={activity ?? undefined}
            >
              {activity ?? (offline ? "—" : "No activity")}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function Presence() {
  const { data, error } = usePresence();

  return (
    <section
      aria-label="Presence"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
    >
      <h2 className="placeholder-label mb-8 text-sm">[NEEDS COPY — section heading]</h2>

      {error ? (
        <p className="mb-4 text-xs text-neutral-400">
          Couldn&apos;t load live presence.
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SpotifyCard data={data} />
        <DiscordCard data={data} />

        <li className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-neutral-400 p-6 text-center text-sm font-medium">
          [CLAUDE CODE]
        </li>
        <li className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-neutral-400 p-6 text-center text-sm font-medium">
          [AFTER EFFECTS]
        </li>
      </ul>
    </section>
  );
}
