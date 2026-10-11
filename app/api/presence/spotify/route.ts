import { NextResponse } from "next/server";
import { getSpotifyPresence } from "@/lib/presence/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSpotifyPresence());
}
