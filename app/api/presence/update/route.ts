import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { AgentSource } from "@/lib/presence/types";

// How long a written key is kept in Redis before it self-expires. This is only a
// garbage-collection safety net — the authoritative "is this source offline?"
// decision lives in app/api/presence/route.ts (STALE_THRESHOLD_MS), keyed off the
// stored `lastSeen`. Kept generous so a paused agent's last status is still
// readable for debugging.
const GC_TTL_SECONDS = 86_400;

const VALID_SOURCES: AgentSource[] = ["claude-code", "after-effects"];

interface PresenceUpdateBody {
  source: AgentSource;
  status: Record<string, unknown>;
  timestamp: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isValidBody(value: unknown): value is PresenceUpdateBody {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.source === "string" &&
    VALID_SOURCES.includes(value.source as AgentSource) &&
    isPlainObject(value.status) &&
    typeof value.timestamp === "number" &&
    Number.isFinite(value.timestamp)
  );
}

export async function POST(req: Request) {
  const expected = process.env.PRESENCE_WRITE_TOKEN;
  const provided = req.headers.get("authorization");

  if (!expected || provided !== `Bearer ${expected}`) {
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
          "Body must be { source: 'claude-code' | 'after-effects', status: object, timestamp: number }",
      },
      { status: 400 }
    );
  }

  const { source, status, timestamp } = payload;

  // Store the raw status object plus a lastSeen stamp. The reader
  // (lib/presence/agents.ts) is responsible for projecting this onto the
  // AgentPresence shape.
  await redis.set(
    `presence:${source}`,
    JSON.stringify({ status, lastSeen: timestamp }),
    { ex: GC_TTL_SECONDS }
  );

  return NextResponse.json({ ok: true });
}
