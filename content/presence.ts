import type { DiscordRawStatus } from "@/lib/presence/types";

// Shown when hovering the person: "<status> @.vyxed".
export const DISCORD_HANDLE = "@.vyxed";

export const STATUS_LABEL: Record<DiscordRawStatus, string> = {
  online: "online",
  idle: "idle",
  dnd: "do not disturb",
  offline: "offline",
};

// The record player's scroll.
export const NOW_PLAYING_TITLE = "Now playing";
export const NOTHING_PLAYING = "Nothing on the turntable right now.";
export const SPOTIFY_PROFILE = "https://open.spotify.com/user/5w9i588o65evpo62d09i3ekuc?si=fed9d08ff0d94316";
