import type { DiscordPresence, DiscordRawStatus } from "./types";

interface LanyardActivity {
  name?: string;
  type?: number;
}

interface LanyardUser {
  id?: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
}

interface LanyardData {
  discord_status?: DiscordRawStatus;
  activities?: LanyardActivity[];
  discord_user?: LanyardUser;
}

interface LanyardResponse {
  success: boolean;
  data?: LanyardData;
}

const FALLBACK_USER_ID = "995695062463823944";

const OFFLINE: DiscordPresence = {
  status: "offline",
  detail: null,
  updatedAt: null,
  discordStatus: "offline",
  activity: null,
  avatarUrl: null,
  displayName: null,
  inServer: false,
};

/** Builds a Discord CDN avatar URL, falling back to a default avatar. */
function avatarUrlFor(user: LanyardUser | undefined): string | null {
  if (!user?.id) return null;
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
  }
  // Default avatar: legacy accounts key off the discriminator, but the new
  // username system uses (id >> 22) % 6.
  let index = 0;
  try {
    index = Number((BigInt(user.id) >> BigInt(22)) % BigInt(6));
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function normalize(discordStatus: DiscordRawStatus): DiscordPresence["status"] {
  if (discordStatus === "offline") return "offline";
  if (discordStatus === "idle") return "idle";
  return "active"; // online, dnd
}

/**
 * Fetches Discord presence via Lanyard. Returns an offline shape on any
 * failure or when Lanyard reports success:false (user not in the server).
 */
export async function getDiscordPresence(): Promise<DiscordPresence> {
  const userId = process.env.DISCORD_USER_ID || FALLBACK_USER_ID;

  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return OFFLINE;

    const body = (await res.json()) as LanyardResponse;

    if (!body.success || !body.data) {
      // Lanyard returns success:false when the user is not in the required server.
      return OFFLINE;
    }

    const discordStatus: DiscordRawStatus = body.data.discord_status ?? "offline";

    // Prefer a real activity over a custom status (type 4).
    const activities = body.data.activities ?? [];
    const activity =
      activities.find((a) => a.type !== 4 && a.name)?.name ??
      activities.find((a) => a.name)?.name ??
      null;

    const user = body.data.discord_user;

    return {
      status: normalize(discordStatus),
      detail: activity,
      updatedAt: Date.now(),
      discordStatus,
      activity,
      avatarUrl: avatarUrlFor(user),
      displayName: user?.global_name || user?.username || null,
      inServer: true,
    };
  } catch {
    return OFFLINE;
  }
}
