import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const TTL_SECONDS = 300;

type PresenceSource = "claude-code" | "after-effects";

interface PresenceUpdateBody {
  source: PresenceSource;
  status: string;
  detail?: string;
}

const VALID_SOURCES: PresenceSource[] = ["claude-code", "after-effects"];

function isValidBody(value: unknown): value is PresenceUpdateBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.source === "string" &&
    VALID_SOURCES.includes(body.source as PresenceSource) &&
    typeof body.status === "string" &&
    body.status.length > 0 &&
    (body.detail === undefined || typeof body.detail === "string")
  );
}

export async function POST(req: Request) {
  const secret = process.env.PRESENCE_SECRET;
  if (!secret || req.headers.get("x-presence-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidBody(payload)) {
    return NextResponse.json(
      {
        error:
          "Body must be { source: 'claude-code' | 'after-effects', status: string, detail?: string }",
      },
      { status: 400 }
    );
  }

  const { source, status, detail } = payload;
  const value = JSON.stringify({ source, status, detail, updatedAt: Date.now() });

  await redis.set(`presence:${source}`, value, { ex: TTL_SECONDS });

  return NextResponse.json({ ok: true });
}
