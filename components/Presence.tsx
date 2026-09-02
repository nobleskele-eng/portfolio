"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { PresenceSnapshot } from "@/lib/presence/types";

// How often to re-fetch the presence snapshot, in ms.
const POLL_INTERVAL_MS = 30_000;

function usePresence() {
  const [data, setData] = useState<PresenceSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/presence", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const snapshot = (await res.json()) as PresenceSnapshot;
        if (!cancelled) {
          setData(snapshot);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { data, error };
}

/* ---- palette (ported from the presence-section design) ---- */
const ACCENT = "oklch(0.65 0.14 45)";
const INK = "#2a2620";
const MUTE = "#b9b3a6";
const GREEN = "#3fa66a";
const AMBER = "#d99a34";
const RED = "#d1544f";
const GRAY = "#a8a29a";

const CARD_STYLE: CSSProperties = {
  background: "#fffdfa",
  borderRadius: 18,
  boxShadow:
    "0 1px 2px rgba(42,38,32,0.05),0 12px 28px -12px rgba(42,38,32,0.14)",
  padding: 26,
  position: "relative",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const CARD_LABEL_STYLE: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: INK,
  marginBottom: 22,
};

const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

function run(on: boolean): CSSProperties["animationPlayState"] {
  return on ? "running" : "paused";
}

/* ============================ SPOTIFY ============================ */
function SpotifyCard({ data }: { data: PresenceSnapshot | null }) {
  const sp = data?.spotify;
  const offline = !sp || sp.status === "offline";
  const active = !offline && sp.isPlaying;

  const opacity = offline ? 0.35 : active ? 1 : 0.75;
  const filter = offline ? "grayscale(1)" : "none";
  const accent = offline ? MUTE : ACCENT;
  const track = offline ? "Nothing playing" : sp.track ?? "Unknown track";
  const artist = offline ? "" : sp.artist ?? "";
  const stateLabel = active ? "Playing" : offline ? "Offline" : "Paused";
  const albumArt = offline ? null : sp.albumArt;

  return (
    <div style={CARD_STYLE} className="lg:col-span-2">
      <div style={CARD_LABEL_STYLE}>Spotify</div>

      <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
        <div
          style={{ position: "relative", width: 96, height: 96, flex: "none" }}
        >
          {/* vinyl disc */}
          <div
            data-pf-anim
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              filter,
              animation: "pf-spin 3.6s linear infinite",
              animationPlayState: run(active),
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: `2px solid ${INK}`,
                opacity: 0.85,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 10,
                borderRadius: "50%",
                border: `1px solid ${INK}`,
                opacity: 0.35,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 22,
                borderRadius: "50%",
                border: `1px solid ${INK}`,
                opacity: 0.35,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 40,
                borderRadius: "50%",
                background: accent,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                margin: "auto",
                top: 46,
                left: 46,
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: INK,
              }}
            />
          </div>

          {/* album art chip */}
          <div
            style={{
              position: "absolute",
              bottom: -6,
              right: -6,
              width: 34,
              height: 34,
              borderRadius: 6,
              overflow: "hidden",
              background: albumArt
                ? undefined
                : "repeating-linear-gradient(45deg,#e7e2d6 0,#e7e2d6 4px,#f6f4ef 4px,#f6f4ef 8px)",
              border: "2px solid #fffdfa",
              boxShadow: "0 1px 3px rgba(42,38,32,0.2)",
              opacity,
            }}
          >
            {albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={albumArt}
                alt={sp?.album ?? ""}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : null}
          </div>
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ position: "relative" }}>
            {/* little bobbing listener */}
            <div
              data-pf-anim
              style={{
                position: "absolute",
                left: 2,
                bottom: "100%",
                width: 19,
                filter,
                opacity: offline ? 0.4 : 1,
                animation: "pf-bob 1.1s ease-in-out infinite",
                animationPlayState: run(active),
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 9,
                  borderRadius: 3,
                  background: accent,
                  margin: "0 auto",
                }}
              />
              <div
                style={{
                  width: 19,
                  height: 16,
                  borderRadius: 4,
                  background: accent,
                  marginTop: 1,
                }}
              />
            </div>

            <TrackTitle
              text={track}
              url={offline ? null : sp?.trackUrl ?? null}
              opacity={opacity}
            />
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#6f695d",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              opacity,
            }}
          >
            {artist}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 12,
            }}
          >
            <span
              data-pf-anim
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: offline ? GRAY : ACCENT,
                animation: "pf-pulse 1.4s ease-in-out infinite",
                animationPlayState: run(active),
              }}
            />
            <span
              style={{ fontSize: 12, fontFamily: MONO, color: "#8a8377" }}
            >
              {stateLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackTitle({
  text,
  url,
  opacity,
}: {
  text: string;
  url: string | null;
  opacity: number;
}) {
  const style: CSSProperties = {
    fontSize: 20,
    fontWeight: 600,
    color: INK,
    lineHeight: 1.25,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    opacity,
  };
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={text}
        style={{ ...style, display: "block", textDecoration: "none" }}
      >
        {text}
      </a>
    );
  }
  return (
    <div style={style} title={text}>
      {text}
    </div>
  );
}

/* ============================ DISCORD ============================ */
const DISCORD_COLORS: Record<string, string> = {
  online: GREEN,
  idle: AMBER,
  dnd: RED,
  offline: GRAY,
};
const DISCORD_LABELS: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
};

function DiscordCard({ data }: { data: PresenceSnapshot | null }) {
  const dc = data?.discord;
  const raw = dc?.discordStatus ?? "offline";
  const offline = !dc || dc.status === "offline";
  const active = raw === "online";

  const color = DISCORD_COLORS[raw] ?? GRAY;
  const name = dc?.displayName ?? DISCORD_LABELS[raw] ?? "Offline";
  const activity = offline ? "—" : dc?.activity ?? "No activity";
  const avatarUrl = dc?.avatarUrl ?? null;

  return (
    <div style={CARD_STYLE}>
      <div style={CARD_LABEL_STYLE}>Discord</div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{ position: "relative", width: 44, height: 44, flex: "none" }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              overflow: "hidden",
              background: avatarUrl
                ? undefined
                : "repeating-linear-gradient(45deg,#e7e2d6 0,#e7e2d6 4px,#f6f4ef 4px,#f6f4ef 8px)",
              border: "2px solid #fffdfa",
              boxShadow: "0 1px 3px rgba(42,38,32,0.15)",
              filter: offline ? "grayscale(1)" : "none",
              opacity: offline ? 0.5 : 1,
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={dc?.displayName ?? "Discord avatar"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : null}
          </div>
          <span
            data-pf-anim
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 15,
              height: 15,
              borderRadius: "50%",
              background: color,
              border: "3px solid #fffdfa",
              animation: "pf-pulse 1.6s ease-in-out infinite",
              animationPlayState: run(active),
            }}
          />
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: INK,
            opacity: offline ? 0.4 : 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={name}
        >
          {name}
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 13,
          color: "#8a8377",
          opacity: offline ? 0.5 : 0.85,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={activity}
      >
        {activity}
      </div>
    </div>
  );
}

/* ========================== CLAUDE CODE ========================== */
function ClaudeCard({ data }: { data: PresenceSnapshot | null }) {
  const cc = data?.claudeCode;
  const offline = !cc || cc.status === "offline";
  const active = !offline && cc.status === "active";

  const filter = offline ? "grayscale(1)" : "none";
  const color = offline ? MUTE : ACCENT;
  const stateLabel = offline ? "No session" : active ? "Active" : "Idle";
  const projectText = offline ? "—" : cc?.detail ?? "session";
  const rawTool = cc?.rawStatus ?? "";
  const toolText =
    offline || ["active", "idle", "offline"].includes(rawTool) ? "" : rawTool;

  return (
    <div style={CARD_STYLE}>
      <div style={{ ...CARD_LABEL_STYLE, marginBottom: 18 }}>Claude Code</div>

      <div
        style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 76 }}
      >
        <div
          style={{
            position: "relative",
            width: 76,
            height: 52,
            filter,
            opacity: offline ? 0.5 : 1,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 6,
              bottom: 10,
              width: 64,
              height: 3,
              background: INK,
              opacity: 0.5,
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 14,
              bottom: 13,
              width: 40,
              height: 24,
              borderRadius: 3,
              background: "#efece3",
              border: `1.5px solid ${INK}`,
              opacity: 0.7,
            }}
          />
          <div
            data-pf-anim
            style={{
              position: "absolute",
              left: 20,
              bottom: 20,
              width: 5,
              height: 8,
              background: INK,
              opacity: offline ? 0 : 1,
              animation: "pf-blink 1s step-end infinite",
              animationPlayState: run(active),
            }}
          />
          <div style={{ position: "absolute", left: 20, bottom: 16, width: 20 }}>
            <div
              style={{
                width: 13,
                height: 10,
                borderRadius: 3,
                background: color,
                margin: "0 auto",
              }}
            />
            <div
              style={{
                width: 20,
                height: 18,
                borderRadius: 4,
                background: color,
                marginTop: 1,
              }}
            />
            <div
              data-pf-anim
              style={{
                position: "absolute",
                top: 8,
                right: -3,
                width: 12,
                height: 5,
                borderRadius: 2,
                background: color,
                transformOrigin: "left center",
                animation: "pf-tap 0.55s ease-in-out infinite",
                animationPlayState: run(active),
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: INK,
            fontFamily: MONO,
            opacity: offline ? 0.35 : 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={projectText}
        >
          {projectText}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: offline ? GRAY : active ? GREEN : AMBER,
            }}
          />
          <span style={{ fontSize: 12, color: "#8a8377" }}>{stateLabel}</span>
          {toolText ? (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 5,
                background: "#efece3",
                color: "#6f695d",
              }}
            >
              {toolText}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ========================= AFTER EFFECTS ========================= */
function AfterEffectsCard({ data }: { data: PresenceSnapshot | null }) {
  const ae = data?.afterEffects;
  const offline = !ae || ae.status === "offline";
  const rawStatus = ae?.rawStatus?.toLowerCase() ?? "";
  const rendering = !offline && /render/.test(rawStatus);
  const editing = !offline && !rendering && ae?.status === "active";
  const active = editing || rendering;

  const filter = offline ? "grayscale(1)" : "none";
  const color = offline ? MUTE : ACCENT;
  const stateLabel = offline
    ? "No session"
    : rendering
    ? "Rendering"
    : editing
    ? "Editing"
    : "Idle";
  const projectText = offline ? "—" : ae?.detail ?? "project.aep";
  const dotColor = offline ? GRAY : rendering || editing ? GREEN : AMBER;

  return (
    <div style={CARD_STYLE} className="sm:col-span-2 lg:col-span-4">
      <div style={{ ...CARD_LABEL_STYLE, marginBottom: 18 }}>After Effects</div>

      <div
        style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 76 }}
      >
        <div
          data-pf-anim
          style={{
            width: 20,
            position: "relative",
            filter,
            opacity: offline ? 0.45 : 1,
            animation: "pf-bob 1.2s ease-in-out infinite",
            animationPlayState: run(editing && !rendering),
          }}
        >
          <div
            style={{
              width: 13,
              height: 10,
              borderRadius: 3,
              background: color,
              margin: "0 auto",
            }}
          />
          <div
            style={{
              width: 20,
              height: 18,
              borderRadius: 4,
              background: color,
              marginTop: 1,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 16,
              width: 11,
              height: 5,
              borderRadius: 2,
              background: color,
              transform: "rotate(-25deg)",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 14, position: "relative", height: 14 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 6,
            height: 2,
            background: INK,
            opacity: 0.18,
            borderRadius: 2,
          }}
        />
        <div
          data-pf-anim
          style={{
            position: "absolute",
            top: 2,
            width: 2,
            height: 10,
            background: offline ? GRAY : ACCENT,
            opacity: offline ? 0.4 : 1,
            left: "6%",
            animation: "pf-scrub 2.4s ease-in-out infinite",
            animationPlayState: run(editing),
          }}
        />
      </div>

      <div
        style={{
          marginTop: 8,
          height: 4,
          borderRadius: 3,
          background: "#efece3",
          overflow: "hidden",
          display: rendering ? "block" : "none",
        }}
      >
        <div
          data-pf-anim
          style={{
            width: "40%",
            height: "100%",
            borderRadius: 3,
            background: ACCENT,
            animation: "pf-render 1.1s ease-in-out infinite",
          }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: INK,
            fontFamily: MONO,
            opacity: offline ? 0.35 : 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={projectText}
        >
          {projectText}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: dotColor,
            }}
          />
          <span style={{ fontSize: 12, color: "#8a8377" }}>{stateLabel}</span>
        </div>
      </div>
    </div>
  );
}

/* ============================ SECTION ============================ */
export default function Presence() {
  const { data, error } = usePresence();

  return (
    <section
      aria-label="Presence"
      style={{
        fontFamily:
          "'Space Grotesk',-apple-system,'Helvetica Neue',Arial,sans-serif",
        background: "#f6f4ef",
      }}
      className="w-full px-8 py-24"
    >
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <h2 className="placeholder-label mb-7">[NEEDS COPY — section heading]</h2>

        {error ? (
          <p className="mb-4 text-xs text-neutral-400">
            Couldn&apos;t load live presence.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SpotifyCard data={data} />
          <DiscordCard data={data} />
          <ClaudeCard data={data} />
          <AfterEffectsCard data={data} />
        </div>
      </div>
    </section>
  );
}
