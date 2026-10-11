"use client";

import { useEffect, useRef, useState } from "react";
import { SONG } from "@/content/song";
import { INK } from "./LinkIcons";

/**
 * Plays the site's song on every visit, looping. Browsers block sound until
 * the visitor interacts, so if autoplay is refused the first click, tap or key
 * anywhere starts it. Pausing here sticks for the rest of the visit.
 */
export default function SongPlayer() {
  const rootRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pausedByUser = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const start = (e?: Event) => {
      // the button's own tap/key also fires touchend/keydown first; leave it to toggle()
      if (e?.target instanceof Node && rootRef.current?.contains(e.target)) return;
      if (pausedByUser.current || !a.paused) return;
      a.volume = SONG.volume;
      a.play().then(
        () => setBlocked(false),
        () => setBlocked(true),
      );
    };
    start();
    const events = ["click", "keydown", "touchend"] as const;
    events.forEach((e) => window.addEventListener(e, start));
    return () => events.forEach((e) => window.removeEventListener(e, start));
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      pausedByUser.current = false;
      a.volume = SONG.volume;
      a.play().catch(() => setBlocked(true));
    } else {
      pausedByUser.current = true;
      a.pause();
    }
  }

  return (
    <div ref={rootRef} data-keep-intro className="ink-player z-40 flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4">
      <button type="button" onClick={toggle} aria-label={playing ? "Pause music" : "Play music"} className="ink-focus grid h-10 w-10 place-items-center rounded-full">
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
          <g filter="url(#ink-edge)">
            <circle cx="20" cy="20" r="16" fill="none" stroke={INK} strokeOpacity={0.8} strokeWidth={2.4} />
            {playing ? (
              <path d="M16 13.5 L16 26.5 M24 13.5 L24 26.5" stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
            ) : (
              <path d="M16.5 13 L27 20 L16.5 27 Z" fill={INK} fillOpacity={0.88} />
            )}
          </g>
        </svg>
      </button>
      <span className="font-ink leading-tight">
        <span className="block text-[15px] text-[#2f2c27]">{SONG.title}</span>
        <span className="block text-xs text-[#6b665c]">{blocked && !playing ? "tap anywhere for sound" : SONG.artist}</span>
      </span>
      <audio ref={audioRef} src={SONG.src} loop preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    </div>
  );
}
