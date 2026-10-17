"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ReadyVideo } from "@/content/videos";
import { clock } from "@/lib/clock";
import { holdSong, releaseSong } from "@/lib/song-hold";

/**
 * A video on an album page, in its own frame with brushed controls instead
 * of the browser's. It plays here and nowhere else: no links out. While it
 * plays, the site's song is held (see SongPlayer).
 */

const PAPER = "#f3e9d3";
// Controls fade out after this long without the pointer moving, while playing.
const HIDE_MS = 2200;
const SEEK_S = 5;

function Icon({ children, size = 22 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <g filter="url(#ink-edge)" fill="none" stroke={PAPER} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

const PlayGlyph = () => <path d="M8 5.5 L18.5 12 L8 18.5 Z" fill={PAPER} fillOpacity={0.9} />;
const PauseGlyph = () => <path d="M8.5 5.5 L8.5 18.5 M15.5 5.5 L15.5 18.5" strokeWidth={3} />;

export default function InkVideo({ video, title, maxHeight }: { video: ReadyVideo; title: string; maxHeight: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const holding = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(video.duration);
  const [muted, setMuted] = useState(false);
  const [idle, setIdle] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState(false);

  const hold = () => {
    if (holding.current) return;
    holding.current = true;
    holdSong();
  };
  const release = () => {
    if (!holding.current) return;
    holding.current = false;
    releaseSong();
  };

  // flipping the page (or closing the scroll) unmounts the player: hand the song back
  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      if (holding.current) {
        holding.current = false;
        releaseSong();
      }
    },
    [],
  );

  // a smooth scrubber while playing; timeupdate alone only ticks a few times a second
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) setTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const onChange = () => setFull(!!wrapRef.current && document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function wake() {
    setIdle(false);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      // keep them up while a control has focus
      if (!wrapRef.current?.contains(document.activeElement)) setIdle(true);
    }, HIDE_MS);
  }

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      // before play(): the click that got us here also reaches SongPlayer's autostart
      hold();
      v.play().catch(() => {
        release();
        setPlaying(false);
      });
    } else {
      v.pause();
    }
    wake();
  }

  function seek(to: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, to), duration);
    setTime(v.currentTime);
  }

  function toggleMute() {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  }

  function toggleFull() {
    const wrap = wrapRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!wrap || !v) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.(); // iPhone Safari only goes fullscreen on the video itself
  }

  function retry() {
    setFailed(false);
    videoRef.current?.load();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const t = e.target as HTMLElement;
    const onButton = t.tagName === "BUTTON";
    const onRange = t.tagName === "INPUT";
    let handled = true;
    switch (e.key) {
      case " ":
        if (onButton) return; // the button clicks itself
        toggle();
        break;
      case "k":
        toggle();
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        toggleFull();
        break;
      case "ArrowLeft":
      case "ArrowRight":
        if (!onRange) seek(time + (e.key === "ArrowLeft" ? -SEEK_S : SEEK_S));
        else handled = false; // the scrubber steps itself
        break;
      default:
        return;
    }
    // keep arrows from flipping the album's page while the player has them
    e.stopPropagation();
    if (handled) e.preventDefault();
    wake();
  }

  const ratio = video.width / video.height;
  const frame: CSSProperties | undefined = full
    ? undefined
    : { aspectRatio: `${video.width} / ${video.height}`, width: `min(100%, calc(${maxHeight} * ${ratio}))` };
  const showControls = !playing || !idle;
  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={`Video: ${title}`}
      onKeyDown={onKeyDown}
      onPointerMove={wake}
      onFocus={wake}
      className={`relative mx-auto overflow-hidden bg-[#1f1d1a] ${full ? "flex h-full w-full items-center" : "rounded-[3px]"} ${playing && idle ? "cursor-none" : ""}`}
      style={{ ...frame, boxShadow: full ? undefined : "0 0 0 1px rgba(120, 92, 54, 0.35), 0 8px 18px -10px rgba(40, 28, 14, 0.55)" }}
    >
      <video
        ref={videoRef}
        className="block h-full w-full object-contain"
        poster={video.poster}
        preload="metadata"
        playsInline
        onPlay={() => {
          hold();
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
          release();
        }}
        onEnded={() => {
          setPlaying(false);
          release();
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
      >
        {video.sources.map((s, i) => (
          <source
            key={s.src}
            src={s.src}
            type={s.type}
            // the browser tries each in turn; only the last one failing means nothing can play
            onError={i === video.sources.length - 1 ? () => setFailed(true) : undefined}
          />
        ))}
      </video>

      {/* the picture itself plays and pauses on click */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={toggle}
        onDoubleClick={toggleFull}
        className="absolute inset-0 h-full w-full cursor-[inherit] bg-transparent"
      />

      {!playing && !failed && (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Play ${title}`}
          className="ink-focus absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
          style={{ background: "rgba(31, 29, 26, 0.45)", boxShadow: `inset 0 0 0 2px ${PAPER}` }}
        >
          <Icon size={30}>
            <PlayGlyph />
          </Icon>
        </button>
      )}
      {waiting && playing && (
        <span aria-hidden className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-[#f3e9d3]/60" />
      )}

      {failed && (
        <div role="alert" className="font-ink absolute inset-0 grid place-items-center bg-[#1f1d1a]/80 p-6 text-center text-[#f3e9d3]">
          <div>
            <p className="text-lg">This video couldn&rsquo;t load.</p>
            <button type="button" onClick={retry} className="ink-focus mt-2 text-base underline decoration-[#b23a2c] underline-offset-4">
              Try again
            </button>
          </div>
        </div>
      )}

      {/* faded out but never click-through: the click that wakes them has to land on the button it started on */}
      <div
        data-no-swipe
        className={`font-ink absolute inset-x-0 bottom-0 px-2.5 pb-1.5 pt-8 text-[#f3e9d3] transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"} ${failed ? "hidden" : ""}`}
        style={{ background: "linear-gradient(to top, rgba(20, 18, 15, 0.7), rgba(20, 18, 15, 0))" }}
      >
        <input
          type="range"
          min={0}
          max={duration}
          step="any"
          value={Math.min(time, duration)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          aria-valuetext={`${clock(time)} of ${clock(duration)}`}
          className="ink-range ink-focus block w-full"
          style={{ "--p": `${progress}%` } as CSSProperties}
        />
        <div className="flex items-center gap-1">
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="ink-focus grid h-9 w-9 shrink-0 place-items-center rounded-full">
            <Icon>{playing ? <PauseGlyph /> : <PlayGlyph />}</Icon>
          </button>
          <span className="mr-auto whitespace-nowrap text-sm tabular-nums">
            {clock(time)} <span className="opacity-60">/ {clock(duration)}</span>
          </span>
          <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="ink-focus grid h-9 w-9 shrink-0 place-items-center rounded-full">
            <Icon>
              <path d="M4 9.5 L8 9.5 L12.5 5.5 L12.5 18.5 L8 14.5 L4 14.5 Z" fill={PAPER} fillOpacity={0.85} />
              {muted ? <path d="M16 9.5 L21 14.5 M21 9.5 L16 14.5" /> : <path d="M16 9 C17.6 10.6 17.6 13.4 16 15 M18.6 6.8 C21.6 9.8 21.6 14.2 18.6 17.2" />}
            </Icon>
          </button>
          <button type="button" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"} className="ink-focus grid h-9 w-9 shrink-0 place-items-center rounded-full">
            <Icon>
              {full ? (
                <path d="M9 4.5 L9 9 L4.5 9 M15 4.5 L15 9 L19.5 9 M9 19.5 L9 15 L4.5 15 M15 19.5 L15 15 L19.5 15" />
              ) : (
                <path d="M4.5 9 L4.5 4.5 L9 4.5 M19.5 9 L19.5 4.5 L15 4.5 M4.5 15 L4.5 19.5 L9 19.5 M19.5 15 L19.5 19.5 L15 19.5" />
              )}
            </Icon>
          </button>
        </div>
      </div>
    </div>
  );
}
