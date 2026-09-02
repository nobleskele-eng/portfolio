import type { SpotifyPresence } from "./types";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_ENDPOINT =
  "https://api.spotify.com/v1/me/player/currently-playing";

interface SpotifyImage {
  url: string;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyTrack {
  name?: string;
  artists?: SpotifyArtist[];
  album?: { name?: string; images?: SpotifyImage[] };
  external_urls?: { spotify?: string };
}

interface NowPlaying {
  is_playing?: boolean;
  currently_playing_type?: string;
  item?: SpotifyTrack | null;
}

const OFFLINE: SpotifyPresence = {
  status: "offline",
  detail: null,
  updatedAt: null,
  isPlaying: false,
  track: null,
  artist: null,
  album: null,
  albumArt: null,
  trackUrl: null,
};

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/**
 * Fetches the currently-playing track from Spotify. Returns an offline shape
 * when nothing is playing, credentials are missing, or any request fails.
 */
export async function getSpotifyPresence(): Promise<SpotifyPresence> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return OFFLINE;

    const res = await fetch(NOW_PLAYING_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    // 204 = nothing playing; 202 = no content yet.
    if (res.status === 204 || res.status === 202) return OFFLINE;
    if (!res.ok) return OFFLINE;

    const data = (await res.json()) as NowPlaying;
    const item = data.item;

    if (!item || !item.name) {
      // Playing an ad or a type we don't render (e.g. episode without item).
      return OFFLINE;
    }

    const isPlaying = data.is_playing ?? false;
    const artist =
      item.artists?.map((a) => a.name).filter(Boolean).join(", ") || null;
    const track = item.name ?? null;

    return {
      status: isPlaying ? "active" : "idle",
      detail: track ? [track, artist].filter(Boolean).join(" — ") : null,
      updatedAt: Date.now(),
      isPlaying,
      track,
      artist,
      album: item.album?.name ?? null,
      albumArt: item.album?.images?.[0]?.url ?? null,
      trackUrl: item.external_urls?.spotify ?? null,
    };
  } catch {
    return OFFLINE;
  }
}
