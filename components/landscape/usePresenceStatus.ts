"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscordPresence, DiscordRawStatus, SpotifyPresence } from "@/lib/presence/types";
import type { Pose } from "@/lib/shanshui/types";

// How often to re-fetch Discord and Spotify presence, in ms.
const POLL_INTERVAL_MS = 30_000;
// Shown until the first Discord response arrives.
const DEFAULT_POSE: Pose = "sit";

/** online / dnd wave, idle sits, offline (incl. invisible) sleeps. */
export function poseFor(status: DiscordRawStatus): Pose {
  if (status === "online" || status === "dnd") return "wave";
  if (status === "idle") return "sit";
  return "sleep";
}

const STATUS_FOR_POSE: Record<Pose, DiscordRawStatus> = { wave: "online", sit: "idle", sleep: "offline" };

/** Dev-only overrides: ?pose=wave|sit|sleep and ?spotify=playing|paused|off. */
function devOverrides() {
  if (process.env.NODE_ENV === "production") return null;
  const q = new URLSearchParams(window.location.search);
  const p = q.get("pose");
  const pose: Pose | null = p === "wave" || p === "sit" || p === "sleep" ? p : null;
  const sp = q.get("spotify");
  const spotify: SpotifyPresence | null =
    sp === "playing" || sp === "paused"
      ? {
          status: sp === "playing" ? "active" : "idle",
          detail: "Sample track — Sample artist",
          updatedAt: Date.now(),
          isPlaying: sp === "playing",
          track: "Sample track",
          artist: "Sample artist",
          album: "Sample album",
          albumArt: null,
          trackUrl: null,
        }
      : null;
  return { pose, spotify, spotifyOff: sp === "off" };
}

export interface Presence {
  pose: Pose;
  /** Discord's own status word; null until the first response. */
  discord: DiscordRawStatus | null;
  /** What's on Spotify; null until the first response. */
  spotify: SpotifyPresence | null;
  /** Re-fetch now (e.g. when the record player's scroll opens). */
  refresh: () => void;
}

/** Discord status (drives the person) and Spotify (drives the record player). */
export function usePresence(): Presence {
  const [discord, setDiscord] = useState<DiscordRawStatus | null>(null);
  const [spotify, setSpotify] = useState<SpotifyPresence | null>(null);
  const loadRef = useRef<() => void>(() => {});

  useEffect(() => {
    const dev = devOverrides();
    let cancelled = false;

    async function get<T>(url: string): Promise<T | null> {
      try {
        const res = await fetch(url, { cache: "no-store" });
        return res.ok ? ((await res.json()) as T) : null;
      } catch {
        return null; // keep the last value
      }
    }

    async function load() {
      const [d, s] = await Promise.all([
        dev?.pose ? null : get<DiscordPresence>("/api/presence/discord"),
        dev?.spotify || dev?.spotifyOff ? null : get<SpotifyPresence>("/api/presence/spotify"),
      ]);
      if (cancelled) return;
      if (d) setDiscord(d.discordStatus);
      if (s) setSpotify(s);
    }

    if (dev?.pose) setDiscord(STATUS_FOR_POSE[dev.pose]);
    if (dev?.spotify) setSpotify(dev.spotify);
    loadRef.current = load;
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const refresh = useCallback(() => loadRef.current(), []);
  return { pose: discord ? poseFor(discord) : DEFAULT_POSE, discord, spotify, refresh };
}
