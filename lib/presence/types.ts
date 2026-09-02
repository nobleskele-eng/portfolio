/**
 * Shared presence shapes.
 *
 * Every widget object carries a normalized `status` of "active" | "idle" |
 * "offline" so the frontend can apply one rule uniformly: if `status` is
 * "offline" (or the whole value is `null`), render the widget's idle state.
 * Widget-specific fields sit alongside `status`.
 */

export type PresenceStatus = "active" | "idle" | "offline";

export interface BasePresence {
  status: PresenceStatus;
  /** Human-readable current activity, or null when offline. */
  detail: string | null;
  /** ms epoch of the underlying data, or null when unknown/offline. */
  updatedAt: number | null;
}

export interface SpotifyPresence extends BasePresence {
  isPlaying: boolean;
  track: string | null;
  artist: string | null;
  album: string | null;
  albumArt: string | null;
  trackUrl: string | null;
}

export type DiscordRawStatus = "online" | "idle" | "dnd" | "offline";

export interface DiscordPresence extends BasePresence {
  /** Discord's own status vocabulary, kept for richer rendering. */
  discordStatus: DiscordRawStatus;
  activity: string | null;
  /** CDN URL of the user's avatar (falls back to a Discord default), or null. */
  avatarUrl: string | null;
  /** Display name / username, or null when unknown. */
  displayName: string | null;
  /** false when Lanyard reports the user is not in the required server. */
  inServer: boolean;
}

export type AgentSource = "claude-code" | "after-effects";

export interface AgentPresence extends BasePresence {
  source: AgentSource;
  /** The free-form status string the agent last posted, or null when offline. */
  rawStatus: string | null;
}

export interface PresenceSnapshot {
  spotify: SpotifyPresence;
  discord: DiscordPresence;
  claudeCode: AgentPresence;
  afterEffects: AgentPresence;
  notebookLM: null;
  googleDocs: null;
}
