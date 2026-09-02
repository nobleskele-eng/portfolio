import { NextResponse } from "next/server";
import { getSpotifyPresence } from "@/lib/presence/spotify";
import { getDiscordPresence } from "@/lib/presence/discord";
import { getAgentPresence } from "@/lib/presence/agents";
import type { PresenceSnapshot } from "@/lib/presence/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [spotify, discord, claudeCode, afterEffects] = await Promise.all([
    getSpotifyPresence(),
    getDiscordPresence(),
    getAgentPresence("claude-code"),
    getAgentPresence("after-effects"),
  ]);

  const snapshot: PresenceSnapshot = {
    spotify,
    discord,
    claudeCode,
    afterEffects,
    notebookLM: null,
    googleDocs: null,
  };

  return NextResponse.json(snapshot);
}
