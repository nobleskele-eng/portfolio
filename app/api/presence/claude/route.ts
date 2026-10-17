import { NextResponse } from "next/server";
import { getAgentPresence } from "@/lib/presence/agents";
import { freshClaude } from "@/lib/presence/fresh";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(freshClaude(await getAgentPresence("claude-code")));
}
