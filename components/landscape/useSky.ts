"use client";

import { useEffect, useState } from "react";
import { skyAt, torontoInstant, type SkyState } from "@/lib/sky";

// How often the sky is worked out again, in ms (the sun moves a quarter of a
// degree a minute, so this is plenty).
const UPDATE_MS = 20_000;
// While time-lapsing (dev), how often.
const LAPSE_UPDATE_MS = 80;

/**
 * Dev-only overrides: ?time=21:30 and ?date=2026-12-21 set Toronto's clock
 * (it keeps running from there), ?speed=600 runs it that many times faster.
 */
function devClock(): { start: number; speed: number } | null {
  if (process.env.NODE_ENV === "production") return null;
  const q = new URLSearchParams(window.location.search);
  const time = q.get("time")?.match(/^(\d{1,2}):(\d{2})$/);
  const date = q.get("date")?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const speed = Number(q.get("speed")) || 1;
  if (!time && !date && speed === 1) return null;
  let start = Date.now();
  if (time || date) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(start).split("-").map(Number);
    const [y, mo, d] = date ? [Number(date[1]), Number(date[2]), Number(date[3])] : today;
    const now = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .format(start)
      .split(":")
      .map(Number);
    const [hh, mm] = time ? [Number(time[1]), Number(time[2])] : now;
    start = torontoInstant(y, mo, d, hh, mm);
  }
  return { start, speed };
}

/** The sky over Toronto right now (null until the page is running). */
export function useSky(): SkyState | null {
  const [sky, setSky] = useState<SkyState | null>(null);

  useEffect(() => {
    const dev = devClock();
    const t0 = Date.now();
    const at = () => (dev ? dev.start + (Date.now() - t0) * dev.speed : Date.now());
    const update = () => setSky(skyAt(at()));
    update();
    const id = setInterval(update, dev && dev.speed > 1 ? LAPSE_UPDATE_MS : UPDATE_MS);
    // a tab coming back from the background catches up at once
    const onShow = () => document.visibilityState === "visible" && update();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  return sky;
}
