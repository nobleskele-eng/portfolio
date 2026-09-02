import { redis } from "@/lib/redis";
import {
  OFFLINE_MAX_AGE_MS,
  type AgentPresence,
  type AgentSource,
} from "./types";

/** Shape written by app/api/presence/update/route.ts. */
interface StoredAgentPresence {
  source?: AgentSource;
  status?: string;
  detail?: string;
  updatedAt?: number;
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

/**
 * Reads presence:{source} from Redis. A missing key, an unparseable value, or
 * one older than OFFLINE_MAX_AGE_MS is treated as offline (the key also has a
 * 300s TTL, so this age check is a fallback for clock/config drift).
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

  if (!stored || typeof stored.updatedAt !== "number") return offline(source);
  if (Date.now() - stored.updatedAt > OFFLINE_MAX_AGE_MS) return offline(source);

  return {
    status: "active",
    detail: stored.detail ?? stored.status ?? null,
    updatedAt: stored.updatedAt,
    source,
    rawStatus: stored.status ?? null,
  };
}
