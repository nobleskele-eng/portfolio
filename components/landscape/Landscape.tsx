"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { HotspotId, Layout, Pose, WorkerMessage } from "@/lib/shanshui/types";
import { IntroTitle, TITLE_FIT, titleSvg } from "./introTitle";
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
// How quickly the depth layers follow the mouse, and the camera the scroll (0..1 per frame).
const MOUSE_EASE = 0.12;
const SCROLL_EASE = 0.22;
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

// The title as it first stands, rendered into the page's HTML.
const TITLE_SVG = titleSvg();

/** The title before any script runs; sized and placed like the canvas that takes over from it. */
function TitleSketch() {
  const { box, opacity, layers } = TITLE_SVG;
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  const F = TITLE_FIT;
  const style = {
    "--aspect": bw / bh,
    "--wide": `${F.wideShare * 100}%`,
    "--tall": `${F.tallShare * 100}%`,
    "--max": `${F.maxPx}px`,
    "--high": F.heightShare * 100,
    "--centre": `${F.centreY * 100}%`,
  } as CSSProperties;
  return (
    <svg aria-hidden className="ink-title-sketch" viewBox={`${box.x0} ${box.y0} ${bw} ${bh}`} style={style}>
      {layers.map((l, i) => (
        <g key={i} fill={l.fill} fillOpacity={opacity}>
          {l.paths.map((d, j) => (
            <path key={j} d={d} />
          ))}
        </g>
      ))}
    </svg>
  );
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
  // the part of the stage a phone always shows, whether or not its browser bars are out
  const safeRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // scroll progress and mouse (current and target), applied once per frame
  const viewRef = useRef({ p: 0, tp: 0, mx: 0, my: 0, tx: 0, ty: 0 });
  const viewRafRef = useRef(0);
  const titleCanvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<IntroTitle | null>(null);

  const [layout, setLayout] = useState<Layout | null>(null);
  const [titleGone, setTitleGone] = useState(false);
  // the canvas has taken the title over from the server-rendered sketch
  const [titleLive, setTitleLive] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<HotspotId | null>(null);
  const [hint, setHint] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  /** The stage's size, and the height of its always-visible part. */
  const stage = useCallback(() => {
    const { width, height } = (wrapRef.current as HTMLDivElement).getBoundingClientRect();
    const safe = safeRef.current?.getBoundingClientRect().height || height;
    return { width, height, safe: Math.min(height, safe) };
  }, []);

  /** Keeps the hotspot overlay glued to the objects as the camera moves. */
  const applyOverlay = useCallback(() => {
    const r = rendererRef.current;
    const el = overlayRef.current;
    if (!r || !el) return;
    const o = r.overlay();
    el.style.transform = `translate(${o.tx}px, ${o.ty}px) scale(${o.z})`;
    el.style.setProperty("--z", String(o.z));
  }, []);

  /** The camera glides after the scroll (and the layers after the mouse) until it settles. */
  const stepView = useCallback(() => {
    viewRafRef.current = 0;
    const v = viewRef.current;
    v.mx += (v.tx - v.mx) * MOUSE_EASE;
    v.my += (v.ty - v.my) * MOUSE_EASE;
    v.p += (v.tp - v.p) * (reducedRef.current ? 1 : SCROLL_EASE);
    if (Math.abs(v.tp - v.p) < 0.0005) v.p = v.tp;
    const easing = Math.abs(v.tx - v.mx) > 0.002 || Math.abs(v.ty - v.my) > 0.002 || v.p !== v.tp;
    const r = rendererRef.current;
    if (r && readyRef.current) {
      r.setView(v.p, v.mx, v.my, performance.now(), easing);
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

  // layout follows the always-visible part's shape; the renderer follows the stage's size
  useEffect(() => {
    const measure = () => {
      const { width, height, safe } = stage();
      if (!width || !height) return;
      const next: Layout = width / safe < TALL_BELOW ? "tall" : "wide";
      setLayout(next);
      titleRef.current?.resize(width, height, window.devicePixelRatio, safe);
      const r = rendererRef.current;
      if (r) {
        r.resize(width, height, window.devicePixelRatio, safe);
        setHotspots(r.hotspots());
        kick();
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapRef.current as HTMLDivElement);
    if (safeRef.current) ro.observe(safeRef.current);
    return () => ro.disconnect();
  }, [kick, stage]);

  useEffect(() => {
    if (layout) onLayout(layout);
  }, [layout, onLayout]);

  // the intro always plays from the top of the page
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  // Scrolling pushes the camera into the corner. Progress is scroll distance
  // over a fixed span (not the window's height), so browser bars sliding in
  // and out on a phone don't nudge the zoom.
  useEffect(() => {
    const onScroll = () => {
      const track = trackRef.current;
      if (!track) return;
      const span = ((safeRef.current?.offsetHeight || window.innerHeight) * ZOOM_SCROLL_VH) / 100;
      const p = Math.max(0, Math.min(1, -track.getBoundingClientRect().top / span));
      viewRef.current.tp = p;
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

  // The title is up from the first paint as server-rendered SVG; the canvas
  // takes over (identically) before the next paint, and un-writes it.
  useLayoutEffect(() => {
    const canvas = titleCanvasRef.current;
    if (!canvas || !wrapRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTitleGone(true);
      return;
    }
    const t = new IntroTitle(canvas);
    const { width, height, safe } = stage();
    t.resize(width, height, window.devicePixelRatio, safe);
    titleRef.current = t;
    drawTitle();
    setTitleLive(true);
  }, [drawTitle, stage]);

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
        const { width, height, safe } = stage();
        r.resize(width, height, window.devicePixelRatio, safe);
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
  }, [layout, reduced, kick, syncReady, stage]);

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
    <div ref={trackRef} className="ink-track relative w-full" style={{ "--zoom": ZOOM_SCROLL_VH } as CSSProperties}>
    <div ref={wrapRef} className="ink-stage paper-bg sticky top-0 w-full overflow-hidden">
      {/* The ink multiplies over the paper as one layer, so inside it the
          landscape's white washes and mist cover the title beneath them. */}
      <div aria-hidden className="absolute inset-0" style={{ mixBlendMode: "multiply" }}>
        {!titleLive && !titleGone && (
          <div className="ink-safe pointer-events-none absolute inset-x-0 top-0">
            <TitleSketch />
          </div>
        )}
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

      <div ref={safeRef} aria-hidden className="ink-safe pointer-events-none absolute inset-x-0 top-0">
        <div className={`ink-scroll-hint ${ready && !scrolled && !hidden ? "ink-scroll-hint--on" : ""}`}>
          <span>scroll</span>
          <svg width="14" height="22" viewBox="0 0 14 22">
            <path d="M7 1 C6.4 7, 7.6 12, 7 19 M2.5 14.5 C4.5 16.5, 5.8 18, 7 20.5 C8.2 18, 9.5 16.5, 11.5 14.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
    </div>
  );
}
