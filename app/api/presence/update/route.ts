import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { AgentSource } from "@/lib/presence/types";

// How long a written key is kept in Redis before it self-expires. This is only a
// garbage-collection safety net — the authoritative "is this source offline?"
// decision lives in lib/presence/fresh.ts, keyed off the
// stored `lastSeen`. Kept generous so a paused agent's last status is still
// readable for debugging.
const GC_TTL_SECONDS = 86_400;

// Largest body accepted. The real hooks send well under 1 KB.
const MAX_BODY_BYTES = 4096;

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

/** Constant-time compare, so response timing can't leak the token. */
function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const hash = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(hash(provided), hash(`Bearer ${expected}`));
}

export async function POST(req: Request) {
  const expected = process.env.PRESENCE_WRITE_TOKEN;

  if (!expected || !tokenMatches(req.headers.get("authorization"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Body too large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
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

  const { source, status } = payload;
  // A timestamp in the future would never go stale; cap it at now.
  const timestamp = Math.min(payload.timestamp, Date.now());

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
