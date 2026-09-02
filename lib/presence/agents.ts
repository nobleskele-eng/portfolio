import { redis } from "@/lib/redis";
import type { AgentPresence, AgentSource, PresenceStatus } from "./types";

/** Shape written by app/api/presence/update/route.ts. */
interface StoredAgentPresence {
  status?: Record<string, unknown>;
  lastSeen?: number;
}

function offline(source: AgentSource): AgentPresence {
  return {
    status: "offline",
    detail: null,
    updatedAt: null,
    source,
    rawStatus: null,
  };
}

/** Pull an optional string field out of the free-form status object. */
function str(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Reads presence:{source} from Redis and projects the stored status object onto
 * the AgentPresence shape. A missing key or an unparseable value is offline.
 *
 * Staleness (lastSeen older than STALE_THRESHOLD_MS) is NOT decided here — the
 * read route (app/api/presence/route.ts) applies that uniformly across all
 * sources. This reader just surfaces `updatedAt` = lastSeen for it to judge.
 */
export async function getAgentPresence(
  source: AgentSource
): Promise<AgentPresence> {
  let stored: StoredAgentPresence | null;
  try {
    stored = await redis.get<StoredAgentPresence>(`presence:${source}`);
  } catch {
    return offline(source);
  }

  if (
    !stored ||
    typeof stored.lastSeen !== "number" ||
    typeof stored.status !== "object" ||
    stored.status === null
  ) {
    return offline(source);
  }

  const status = stored.status;
  const rawStatus = str(status, "state") ?? str(status, "status");
  const normalized: PresenceStatus = rawStatus === "idle" ? "idle" : "active";

  return {
    status: normalized,
    detail: str(status, "detail") ?? str(status, "text"),
    updatedAt: stored.lastSeen,
    source,
    rawStatus,
  };
}
