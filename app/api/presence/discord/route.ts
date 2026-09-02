import { NextResponse } from "next/server";
import { getDiscordPresence } from "@/lib/presence/discord";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getDiscordPresence());
}
