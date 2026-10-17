import type { DiscordRawStatus, PresenceStatus } from "@/lib/presence/types";

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

// The lantern's scroll (Claude Code). Its seal reads "✻ claude · <what Claude
// is doing>" while working, "✻ claude · resting" while idle (just "✻ claude"
// on touch screens, where every seal stays up) and CLAUDE_SEAL when dark.
export const CLAUDE_TITLE = "Claude's lantern";
export const CLAUDE_SEAL = "claude";
export const CLAUDE_STATE: Record<PresenceStatus, string> = {
  active: "working",
  idle: "resting",
  offline: "away",
};
export const CLAUDE_DARK = "The lantern is dark. Claude isn't working right now.";
export const CLAUDE_ABOUT =
  "Claude Code is the AI I build with. A small hook on my machine tells this site whenever Claude starts a task, picks up a tool or finishes, so this lantern follows along live: it burns while Claude works and smoulders while it waits for me.";
export const CLAUDE_HOOK_SOURCE = "https://github.com/nobleskele-eng/portfolio/tree/main/scripts/claude-presence-hook";
