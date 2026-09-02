import { NextResponse } from "next/server";
import { getSpotifyPresence } from "@/lib/presence/spotify";
import { getDiscordPresence } from "@/lib/presence/discord";
import { getAgentPresence } from "@/lib/presence/agents";
import type { BasePresence, PresenceSnapshot } from "@/lib/presence/types";

// A source whose most recent data (`updatedAt`) is older than this is reported
// as "offline", regardless of what it last said. Applied uniformly to every
// source below. Tune here.
const STALE_THRESHOLD_MS = 60_000;

export const dynamic = "force-dynamic";

/** Force any source with stale (or missing) data into the offline shape. */
function freshOrOffline<T extends BasePresence>(presence: T): T {
  if (presence.status === "offline") return presence;
  if (
    presence.updatedAt === null ||
    Date.now() - presence.updatedAt > STALE_THRESHOLD_MS
  ) {
    return { ...presence, status: "offline", detail: null };
  }
  return presence;
}

export async function GET() {
  const [spotify, discord, claudeCode, afterEffects] = await Promise.all([
    getSpotifyPresence(),
    getDiscordPresence(),
    getAgentPresence("claude-code"),
    getAgentPresence("after-effects"),
  ]);

  const snapshot: PresenceSnapshot = {
    spotify: freshOrOffline(spotify),
    discord: freshOrOffline(discord),
    claudeCode: freshOrOffline(claudeCode),
    afterEffects: freshOrOffline(afterEffects),
    notebookLM: null,
    googleDocs: null,
  };

  return NextResponse.json(snapshot);
}
