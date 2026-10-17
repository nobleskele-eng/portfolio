/**
 * The sky over Toronto: where the sun and moon stand at a given instant, the
 * moon's phase, and how dark it is. Low-precision formulas (a few tenths of a
 * degree for the sun, about a degree for the moon), plenty for a painting.
 * Angles are in degrees unless named otherwise.
 */

export const TIME_ZONE = "America/Toronto";
const LAT = 43.6532;
const LON = -79.3832;

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
// the sun's distance and the moon's mean distance, in km (for the phase)
const SUN_KM = 149_598_000;

/** A body's place in the sky: altitude above the horizon, and hour angle (0 at its highest, negative before). */
export interface SkyPoint {
  alt: number;
  ha: number;
}

/** What the renderer needs to paint the sky. */
export interface Sky {
  sun: SkyPoint;
  moon: SkyPoint & {
    /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter */
    phase: number;
    /** share of the disc that's lit, 0..1 */
    lit: number;
  };
  /** 0 in daylight, 1 at full night */
  dark: number;
  /** the glow of sunrise and sunset, 0..1 */
  warm: number;
}

export type Period = "night" | "dawn" | "morning" | "afternoon" | "dusk";

export interface SkyState extends Sky {
  at: number;
  period: Period;
  /** Toronto wall clock, e.g. "9:42 pm" */
  clock: string;
}

/* ------------------------------------------------------------- astronomy */

/** Days since J2000.0 (2000-01-01 12:00 TT). */
const days = (ms: number) => ms / DAY_MS - 10957.5;

const wrap = (a: number) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

/** Obliquity of the ecliptic, radians. */
const tilt = (d: number) => (23.4393 - 0.0000004 * d) * RAD;

function equatorial(lon: number, lat: number, d: number) {
  const e = tilt(d);
  return {
    ra: Math.atan2(Math.sin(lon) * Math.cos(e) - Math.tan(lat) * Math.sin(e), Math.cos(lon)),
    dec: Math.asin(Math.sin(lat) * Math.cos(e) + Math.cos(lat) * Math.sin(e) * Math.sin(lon)),
  };
}

function sunAt(d: number) {
  const m = (357.5291 + 0.98560028 * d) * RAD;
  const centre = (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) * RAD;
  const lon = m + centre + 102.9372 * RAD + Math.PI;
  return equatorial(lon, 0, d);
}

function moonAt(d: number) {
  const l = (218.316 + 13.176396 * d) * RAD;
  const m = (134.963 + 13.064993 * d) * RAD;
  const f = (93.272 + 13.22935 * d) * RAD;
  const lon = l + 6.289 * RAD * Math.sin(m);
  const lat = 5.128 * RAD * Math.sin(f);
  return { ...equatorial(lon, lat, d), km: 385_001 - 20_905 * Math.cos(m) };
}

/** Altitude and hour angle over Toronto for a body at (ra, dec), radians in. */
function place(ra: number, dec: number, d: number): SkyPoint {
  const sidereal = (280.16 + 360.9856235 * d) * RAD + LON * RAD;
  const h = wrap(sidereal - ra);
  const phi = LAT * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h));
  return { alt: alt / RAD, ha: h / RAD };
}

export function sunPoint(ms: number): SkyPoint {
  const d = days(ms);
  const s = sunAt(d);
  return place(s.ra, s.dec, d);
}

/** The moon's place, phase and lit share. */
export function moonPoint(ms: number): Sky["moon"] {
  const d = days(ms);
  const s = sunAt(d);
  const m = moonAt(d);
  // the angle between them, as seen from the moon, gives how much is lit
  const el = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(SUN_KM * Math.sin(el), m.km - SUN_KM * Math.cos(el));
  const side = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
  );
  const phase = 0.5 + (0.5 * inc * (side < 0 ? -1 : 1)) / Math.PI;
  return { ...place(m.ra, m.dec, d), phase: ((phase % 1) + 1) % 1, lit: (1 + Math.cos(inc)) / 2 };
}

/* ------------------------------------------------------------------ light */

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/** Fully light with the sun 4° up, fully dark by 10° below the horizon. */
export const darkness = (sunAlt: number) => ease((4 - sunAlt) / 14);
/** Sunrise and sunset glow: strongest with the sun on the horizon. */
export const warmth = (sunAlt: number) => ease(1 - Math.abs(sunAlt - 0.5) / 9);

/** Night and twilight by the sun; morning and afternoon by the clock (hour 0..23). */
export function periodOf(sun: SkyPoint, hour: number): Period {
  if (sun.alt < -6) return "night";
  if (sun.alt < 6) return sun.ha < 0 ? "dawn" : "dusk";
  return hour < 12 ? "morning" : "afternoon";
}

const clockFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "long", month: "long", day: "numeric" });

/** Toronto wall-clock time, e.g. "9:42 pm". */
export const torontoClock = (ms: number) => clockFormat.format(ms).replace(/\s?([AP])M$/i, (_, a: string) => ` ${a.toLowerCase()}m`);
/** Toronto date, e.g. "Thursday, October 16". */
export const torontoDay = (ms: number) => dayFormat.format(ms);

export function skyAt(ms: number): SkyState {
  const sun = sunPoint(ms);
  const moon = moonPoint(ms);
  return {
    at: ms,
    sun,
    moon,
    dark: darkness(sun.alt),
    warm: warmth(sun.alt),
    period: periodOf(sun, new Date(wallAsUtc(ms)).getUTCHours()),
    clock: torontoClock(ms),
  };
}

/**
 * Today's sunrise and sunset in Toronto (the sun's top edge on the horizon,
 * with refraction), found by stepping through the local day. null when it
 * doesn't happen (never, this far south, but cheap to allow).
 */
export function sunTimes(ms: number): { rise: number | null; set: number | null } {
  const start = torontoMidnight(ms);
  const h = (t: number) => sunPoint(t).alt + 0.833;
  const step = 10 * 60_000;
  let rise: number | null = null;
  let set: number | null = null;
  let prev = h(start);
  for (let t = start + step; t <= start + DAY_MS; t += step) {
    const cur = h(t);
    if (prev < 0 && cur >= 0 && rise === null) rise = t - step + (step * -prev) / (cur - prev);
    if (prev >= 0 && cur < 0 && set === null) set = t - step + (step * prev) / (prev - cur);
    prev = cur;
  }
  return { rise, set };
}

/** The instant of the Toronto wall-clock time y-m-d hh:mm. */
export function torontoInstant(y: number, mo: number, d: number, hh: number, mm: number): number {
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  return guess - (wallAsUtc(guess) - guess);
}

/** Toronto's wall clock at `ms`, read back as if it were UTC. */
function wallAsUtc(ms: number): number {
  const parts: Record<string, number> = {};
  for (const p of partsFormat.formatToParts(ms)) if (p.type !== "literal") parts[p.type] = Number(p.value);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
}

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

function torontoMidnight(ms: number): number {
  const wall = new Date(wallAsUtc(ms));
  return torontoInstant(wall.getUTCFullYear(), wall.getUTCMonth() + 1, wall.getUTCDate(), 0, 0);
}

/* ------------------------------------------------------------------ moon */

export function phaseName(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return "new moon";
  if (phase < 0.22) return "waxing crescent";
  if (phase < 0.28) return "first quarter";
  if (phase < 0.47) return "waxing gibbous";
  if (phase < 0.53) return "full moon";
  if (phase < 0.72) return "waning gibbous";
  if (phase < 0.78) return "last quarter";
  return "waning crescent";
}

/**
 * The lit part of a moon of radius r centred on the origin, as SVG path data
 * (Path2D takes it too). Lit on the right while waxing, the left while
 * waning, as it looks from Toronto.
 */
export function moonPath(r: number, phase: number): string {
  const k = Math.cos(2 * Math.PI * phase);
  const rx = Math.max(0.001, Math.abs(k) * r);
  const waxing = phase < 0.5;
  const outer = waxing ? 1 : 0;
  const inner = waxing ? (k > 0 ? 0 : 1) : k > 0 ? 1 : 0;
  return `M0 ${-r} A${r} ${r} 0 0 ${outer} 0 ${r} A${rx} ${r} 0 0 ${inner} 0 ${-r} Z`;
}
