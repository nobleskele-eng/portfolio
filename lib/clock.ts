/** Seconds as m:ss, e.g. 83.4 → "1:23". */
export function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** How long ago an ms-epoch time was, roughly, e.g. "just now", "3 min ago", "2 h ago". */
export function ago(at: number, now = Date.now()) {
  const min = Math.floor(Math.max(0, now - at) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "a day ago" : `${d} days ago`;
}
