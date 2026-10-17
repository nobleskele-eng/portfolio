import type { AgentPresence, BasePresence } from "./types";

// A source whose most recent data (`updatedAt`) is older than this is reported
// as "offline", regardless of what it last said. Tune here.
export const STALE_THRESHOLD_MS = 60_000;

// Claude Code only reports on events (a prompt, a tool call, a stop), so a long
// think or a long reply goes quiet for minutes while still working. Its active
// and idle states each get their own, longer, window.
const CLAUDE_ACTIVE_MS = 10 * 60_000;
const CLAUDE_IDLE_MS = 30 * 60_000;

/** Force a source with stale (or missing) data into the offline shape. */
export function freshOrOffline<T extends BasePresence>(
  presence: T,
  maxAgeMs = STALE_THRESHOLD_MS
): T {
  if (presence.status === "offline") return presence;
  if (
    presence.updatedAt === null ||
    Date.now() - presence.updatedAt > maxAgeMs
  ) {
    return { ...presence, status: "offline", detail: null };
  }
  return presence;
}

/** freshOrOffline with Claude Code's longer windows. */
export function freshClaude(presence: AgentPresence): AgentPresence {
  const maxAge = presence.status === "idle" ? CLAUDE_IDLE_MS : CLAUDE_ACTIVE_MS;
  return freshOrOffline(presence, maxAge);
}
