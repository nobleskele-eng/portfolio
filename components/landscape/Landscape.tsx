"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HotspotId, Layout, Pose, WorkerMessage } from "@/lib/shanshui/types";
import { IntroTitle } from "./introTitle";
import { InkRenderer, type Hotspot } from "./renderer";

// Viewports narrower than this (width / height) get the tall phone layout.
const TALL_BELOW = 0.8;
// How long the seals stay up after the intro to show what's clickable.
const HINT_MS = 3200;
// Idle frame swaps (person, lake, clouds, record) are checked at this cadence.
const IDLE_TICK_MS = 60;
// How much page there is to scroll through while the camera pushes into the
// corner, in viewport heights.
const ZOOM_SCROLL_VH = 150;
// How quickly the depth layers follow the mouse (0..1 per frame).
const MOUSE_EASE = 0.12;
// The title un-writes itself over this stretch of the intro (scene seconds,
// which the renderer plays faster than real time): while the far hills and
// the first mountains paint in over it.
const TITLE_FROM = 0.4;
const TITLE_TO = 2.6;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Dev-only `?seed=` override for previewing other landscapes. */
function devSeed(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  return new URLSearchParams(window.location.search).get("seed") || undefined;
}

function tileToUrl(size: number, data: Uint8ClampedArray): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), size, size), 0, 0);
  return c.toDataURL("image/png");
}

export default function Landscape({
  pose,
  playing,
  seals,
  labels,
  hidden,
  onOpen,
  onLayout,
}: {
  pose: Pose;
  /** Spotify is playing: the record spins */
  playing: boolean;
  /** red seal text shown on hover, per hotspot */
  seals: Record<HotspotId, string>;
  /** accessible names, per hotspot */
  labels: Record<HotspotId, string>;
  /** a panel is open: take the hotspots out of the tab order */
  hidden: boolean;
  onOpen: (id: HotspotId, trigger: HTMLButtonElement) => void;
  onLayout: (layout: Layout) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<InkRenderer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const rafRef = useRef(0);
  const readyRef = useRef(false);
  const firstBuildRef = useRef(true);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const trackRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // scroll progress and mouse (current and target), applied once per frame
  const viewRef = useRef({ p: 0, mx: 0, my: 0, tx: 0, ty: 0 });
  const viewRafRef = useRef(0);
  const titleCanvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<IntroTitle | null>(null);

  const [layout, setLayout] = useState<Layout | null>(null);
  const [titleGone, setTitleGone] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<HotspotId | null>(null);
  const [hint, setHint] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduced = useReducedMotion();

  /** Keeps the hotspot overlay glued to the objects as the camera moves. */
  const applyOverlay = useCallback(() => {
    const r = rendererRef.current;
    const el = overlayRef.current;
    if (!r || !el) return;
    const o = r.overlay();
    el.style.transform = `translate(${o.tx}px, ${o.ty}px) scale(${o.z})`;
    el.style.setProperty("--z", String(o.z));
  }, []);

  const stepView = useCallback(() => {
    viewRafRef.current = 0;
    const v = viewRef.current;
    v.mx += (v.tx - v.mx) * MOUSE_EASE;
    v.my += (v.ty - v.my) * MOUSE_EASE;
    const easing = Math.abs(v.tx - v.mx) > 0.002 || Math.abs(v.ty - v.my) > 0.002;
    const r = rendererRef.current;
    if (r && readyRef.current) {
      r.setView(v.p, v.mx, v.my, performance.now());
      applyOverlay();
    }
    if (easing) viewRafRef.current = requestAnimationFrame(stepView);
  }, [applyOverlay]);

  const kickView = useCallback(() => {
    if (!viewRafRef.current) viewRafRef.current = requestAnimationFrame(stepView);
  }, [stepView]);

  /** Mirrors the renderer's "intro finished" into React state. */
  const syncReady = useCallback(() => {
    const r = rendererRef.current;
    if (r && r.ready && !readyRef.current) {
      readyRef.current = true;
      setReady(true);
      setHotspots(r.hotspots());
      kickView();
    }
  }, [kickView]);

  /** The title follows the intro clock; once it's fully un-written its canvas goes. */
  const drawTitle = useCallback(() => {
    const t = titleRef.current;
    if (!t) return;
    const time = rendererRef.current?.introTime ?? 0;
    const p = Math.max(0, Math.min(1, (time - TITLE_FROM) / (TITLE_TO - TITLE_FROM)));
    t.draw(p);
    if (p >= 1) {
      titleRef.current = null;
      setTitleGone(true);
    }
  }, []);

  const loop = useCallback(() => {
    rafRef.current = 0;
    const r = rendererRef.current;
    if (!r) return;
    const running = r.tick(performance.now());
    drawTitle();
    syncReady();
    if (running) rafRef.current = requestAnimationFrame(loop);
  }, [syncReady, drawTitle]);

  const kick = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  // layout follows the container's shape; the renderer follows its size
  useEffect(() => {
    const el = wrapRef.current as HTMLDivElement;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const next: Layout = width / height < TALL_BELOW ? "tall" : "wide";
      setLayout(next);
      titleRef.current?.resize(width, height, window.devicePixelRatio);
      const r = rendererRef.current;
      if (r) {
        r.resize(width, height, window.devicePixelRatio);
        setHotspots(r.hotspots());
        kick();
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [kick]);

  useEffect(() => {
    if (layout) onLayout(layout);
  }, [layout, onLayout]);

  // the intro always plays from the top of the page
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  // scrolling pushes the camera into the corner
  useEffect(() => {
    const onScroll = () => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.max(0, Math.min(1, -rect.top / span)) : 0;
      viewRef.current.p = p;
      setScrolled(p > 0.02);
      kickView();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [kickView]);

  // on desktop, the mouse nudges the depth layers apart
  useEffect(() => {
    if (reduced || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      viewRef.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      viewRef.current.ty = (e.clientY / window.innerHeight) * 2 - 1;
      kickView();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, kickView]);

  useEffect(
    () => () => {
      cancelAnimationFrame(viewRafRef.current);
      viewRafRef.current = 0;
    },
    [],
  );

  // the overlay mounts with the hotspots; place it before it paints
  useLayoutEffect(() => {
    if (ready) applyOverlay();
  }, [ready, hotspots, applyOverlay]);

  // the title is up from the first paint, before the landscape has started
  useLayoutEffect(() => {
    const canvas = titleCanvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTitleGone(true);
      return;
    }
    const t = new IntroTitle(canvas);
    const { width, height } = wrap.getBoundingClientRect();
    t.resize(width, height, window.devicePixelRatio);
    titleRef.current = t;
    drawTitle();
  }, [drawTitle]);

  useEffect(() => {
    const worker = new Worker(new URL("../../lib/shanshui/worker.ts", import.meta.url));
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // (re)build the scene for the current layout; only the first build animates
  useEffect(() => {
    const worker = workerRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!layout || !worker || !canvas || !wrap) return;

    const animate = firstBuildRef.current && !reduced;
    firstBuildRef.current = false;
    readyRef.current = false;
    setReady(false);

    const r = new InkRenderer(canvas);
    r.pose = poseRef.current;
    r.playing = playingRef.current;
    r.setStill(reduced);
    if (!animate) r.skip(performance.now());
    rendererRef.current = r;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __ink: InkRenderer }).__ink = r;
    const { width, height } = wrap.getBoundingClientRect();

    const onMessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data;
      const now = performance.now();
      if (m.type === "paper") {
        const url = `url(${tileToUrl(m.size, m.data)})`;
        wrap.style.backgroundImage = url;
        document.documentElement.style.setProperty("--paper-tile", url);
        return;
      }
      if (m.layout !== layout || rendererRef.current !== r) return;
      if (m.type === "world") {
        r.resize(width, height, window.devicePixelRatio);
        r.setWorld(m.world);
      } else if (m.type === "part") {
        const p = m.part;
        if (p.kind === "group") r.addGroup(p, now);
        else if (p.kind === "object") r.addObject(p, now);
        else if (p.kind === "record") r.setRecord(p, now);
        else r.setPerson(p, now);
        setHotspots(r.hotspots());
      }
      syncReady();
      kick();
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage({ type: "build", layout, seed: devSeed() });
    return () => worker.removeEventListener("message", onMessage);
  }, [layout, reduced, kick, syncReady]);

  // once the painting is done, briefly show the seals so it's clear what to click
  useEffect(() => {
    if (!ready || reduced) return;
    setHint(true);
    const t = setTimeout(() => setHint(false), HINT_MS);
    return () => clearTimeout(t);
  }, [ready, reduced]);

  // idle: the person, the lake and the record each swap frames on their own clock
  useEffect(() => {
    if (!ready || reduced) return;
    const id = setInterval(() => {
      const r = rendererRef.current;
      const now = performance.now();
      if (r && r.frameDue(now)) r.render(now);
    }, IDLE_TICK_MS);
    return () => clearInterval(id);
  }, [ready, reduced]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.setPose(pose, performance.now());
    setHotspots(r.hotspots());
    kick();
  }, [pose, kick]);

  useEffect(() => {
    rendererRef.current?.setHover(hover, performance.now());
  }, [hover]);

  useEffect(() => {
    rendererRef.current?.setPlaying(playing, performance.now());
  }, [playing]);

  // any click, tap, key or scroll during the intro skips to the finished
  // painting (except on controls marked data-keep-intro, like the song player)
  useEffect(() => {
    if (ready) return;
    const skip = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("[data-keep-intro]")) return;
      rendererRef.current?.skip(performance.now());
      syncReady();
      kick();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" && !e.metaKey && !e.ctrlKey) skip(e);
    };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchmove", skip, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
    };
  }, [ready, kick, syncReady]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    },
    [],
  );

  return (
    <div ref={trackRef} className="relative w-full" style={{ height: `calc(100svh + ${ZOOM_SCROLL_VH}svh)` }}>
    <div ref={wrapRef} className="paper-bg sticky top-0 h-[100svh] w-full overflow-hidden">
      {/* The ink multiplies over the paper as one layer, so inside it the
          landscape's white washes and mist cover the title beneath them. */}
      <div aria-hidden className="absolute inset-0" style={{ mixBlendMode: "multiply" }}>
        {!titleGone && <canvas ref={titleCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />}
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      {ready && (
        <div ref={overlayRef} className="absolute inset-0 origin-top-left" aria-hidden={hidden || undefined}>
          {hotspots.map((h) => {
            const showSeal = hint || hover === h.id;
            return (
              <button
                key={h.id}
                type="button"
                aria-label={labels[h.id]}
                tabIndex={hidden ? -1 : 0}
                className="ink-hotspot ink-focus absolute rounded-xl"
                style={{ left: h.x, top: h.y, width: h.w, height: h.h }}
                onPointerEnter={() => setHover(h.id)}
                onPointerLeave={() => setHover((v) => (v === h.id ? null : v))}
                onFocus={() => setHover(h.id)}
                onBlur={() => setHover((v) => (v === h.id ? null : v))}
                onClick={(e) => onOpen(h.id, e.currentTarget)}
              >
                <span
                  aria-hidden
                  className={`ink-seal ${showSeal ? "ink-seal--on" : ""}`}
                  style={{ left: h.sx, top: h.sy }}
                >
                  {seals[h.id]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div aria-hidden className={`ink-scroll-hint ${ready && !scrolled && !hidden ? "ink-scroll-hint--on" : ""}`}>
        <span>scroll</span>
        <svg width="14" height="22" viewBox="0 0 14 22">
          <path d="M7 1 C6.4 7, 7.6 12, 7 19 M2.5 14.5 C4.5 16.5, 5.8 18, 7 20.5 C8.2 18, 9.5 16.5, 11.5 14.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
    </div>
  );
}
