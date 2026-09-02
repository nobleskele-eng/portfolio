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

function SpotifyCard({ data }: { data: PresenceSnapshot | null }) {
  const spotify = data?.spotify;

  if (!spotify || spotify.status === "offline") {
    return (
      <Card title="Spotify">
        <span className="text-neutral-500">Not playing</span>
      </Card>
    );
  }

  return (
    <Card title="Spotify">
      <div className="flex gap-3">
        {spotify.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={spotify.albumArt}
            alt={spotify.album ?? ""}
            className="h-12 w-12 rounded"
          />
        ) : null}
        <div className="min-w-0">
          <div className="truncate font-medium">
            {spotify.trackUrl ? (
              <a
                href={spotify.trackUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {spotify.track}
              </a>
            ) : (
              spotify.track
            )}
          </div>
          <div className="truncate text-neutral-500">{spotify.artist}</div>
          <div className="text-xs text-neutral-400">
            {spotify.isPlaying ? "Playing" : "Paused"}
          </div>
        </div>
      </div>
    </Card>
  );
}

const DISCORD_STATUS_LABEL: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do not disturb",
  offline: "Offline",
};

function DiscordCard({ data }: { data: PresenceSnapshot | null }) {
  const discord = data?.discord;

  if (!discord || discord.status === "offline") {
    return (
      <Card title="Discord">
        <span className="text-neutral-500">Offline</span>
      </Card>
    );
  }

  return (
    <Card title="Discord">
      <div className="font-medium">
        {DISCORD_STATUS_LABEL[discord.discordStatus] ?? discord.discordStatus}
      </div>
      {discord.activity ? (
        <div className="text-neutral-500">{discord.activity}</div>
      ) : (
        <div className="text-neutral-400">No activity</div>
      )}
    </Card>
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
