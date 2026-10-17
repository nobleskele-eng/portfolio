"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AE_TITLE, type AeProject } from "@/content/after-effects";
import { LINKS } from "@/content/links";
import { NO_VIDEO_YET, SHELVES, WORKS, type ShelfId, type Work } from "@/content/projects";
import { readyVideo, type ReadyVideo } from "@/content/videos";
import { clock } from "@/lib/clock";
import AeProjectCard from "./AeProjectCard";
import { HEADING } from "./heading";
import InkVideo from "./InkVideo";
import { INK } from "./LinkIcons";

/**
 * One volume of the bookshelf as an album: a spread per work, its notes on
 * the left leaf and its video on the right (stacked on phones). The arrows,
 * the arrow keys or a swipe turn the page; Esc goes back to the shelf.
 */

const EASE = [0.22, 0.8, 0.3, 1] as const;
// A swipe has to travel this far, and be mostly sideways, to turn the page.
const SWIPE_PX = 50;
// How tall a video may be: what's left of the scroll after its header and padding.
const VIDEO_MAX = { wide: "min(60svh, calc(78svh - 210px))", tall: "min(46svh, calc(72svh - 200px))" };

const FOLLOW = LINKS.find((l) => l.handle === "@stayvyxed");
const LINK = "ink-focus underline decoration-[#b23a2c]/50 underline-offset-4 hover:decoration-[#b23a2c]";

function Arrow({ dir }: { dir: -1 | 1 }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d={dir < 0 ? "M15 5 L8 12 L15 19" : "M9 5 L16 12 L9 19"}
        filter="url(#ink-edge)"
        fill="none"
        stroke={INK}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Notes({ work, video }: { work: Work; video: ReadyVideo | null }) {
  const meta = [work.group, work.year, video && clock(video.duration)].filter(Boolean).join(" · ");
  // one long word (DONTPLAYBYTHARULES) won't fit the leaf at full size
  const long = work.title.split(" ").some((w) => w.length > 14);
  return (
    <div className="font-ink">
      <h3 className={`${long ? "text-xl" : "text-2xl"} font-medium leading-tight text-[#2f2c27] [overflow-wrap:anywhere]`}>{work.title}</h3>
      {meta && <p className="mt-1 text-sm uppercase tracking-[0.18em] text-[#8a8478]">{meta}</p>}
      {work.note && <p className="mt-3 text-lg leading-relaxed text-[#4a463f]">{work.note}</p>}
      {work.tools && <p className="mt-3 text-sm uppercase tracking-[0.18em] text-[#8a8478]">{work.tools.join(" · ")}</p>}
      {work.href && (
        <p className="mt-4 text-lg text-[#4a463f]">
          <a href={work.href} target="_blank" rel="noreferrer" className={LINK}>
            See the code
          </a>
        </p>
      )}
    </div>
  );
}

function NoVideo() {
  return (
    <div
      className="font-ink grid w-full place-items-center rounded-[3px] border border-dashed border-[#2f2c27]/30 px-6 py-8 text-center"
      style={{ aspectRatio: "16 / 9" }}
    >
      <div>
        <p className="text-lg text-[#4a463f]">{NO_VIDEO_YET}</p>
        {FOLLOW && (
          <p className="mt-2 text-base text-[#6b665c]">
            Follow along on{" "}
            <a href={FOLLOW.href} target="_blank" rel="noreferrer" className={LINK}>
              {FOLLOW.label} {FOLLOW.handle}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

export default function Album({
  titleId,
  shelf,
  index,
  vertical,
  aeProjects,
  onIndex,
  onBack,
}: {
  titleId: string;
  shelf: ShelfId;
  index: number;
  /** the phone's hanging scroll: stack the leaves */
  vertical: boolean;
  aeProjects: AeProject[];
  onIndex: (i: number) => void;
  onBack: () => void;
}) {
  const reduced = useReducedMotion();
  const works = WORKS.filter((w) => w.shelf === shelf);
  const volume = SHELVES.find((s) => s.id === shelf);
  const title = volume?.title ?? shelf;
  const at = Math.max(0, Math.min(index, works.length - 1));
  const work = works[at];

  const [dir, setDir] = useState(1);
  const backRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  // the spine that opened this is gone: start keyboard focus here
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  if (!work) return null;
  const video = readyVideo(work.video);
  const ae = work.ae ? aeProjects.find((p) => p.slug === work.ae) : undefined;

  function go(i: number) {
    if (i < 0 || i >= works.length || i === at) return;
    setDir(i > at ? 1 : -1);
    onIndex(i);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      go(at + (e.key === "ArrowLeft" ? -1 : 1));
    } else if (e.key === "Escape") {
      // back to the shelf first; the next Esc closes the scroll
      e.stopPropagation();
      onBack();
    }
  }

  const flip = {
    enter: (d: number) => ({ x: reduced ? 0 : d * 40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: reduced ? 0 : d * -40, opacity: 0 }),
  };

  return (
    <div onKeyDown={onKeyDown}>
      <button ref={backRef} type="button" onClick={onBack} className="ink-focus font-ink -ml-1 mb-2 px-1 text-base text-[#6b665c] hover:text-[#2f2c27]">
        ← the shelf
      </button>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 id={titleId} className={`${HEADING} !mb-0`}>
            {title}
          </h2>
          {volume?.note && <p className="font-ink text-base italic text-[#6b665c]">{volume.note}</p>}
        </div>
        {works.length > 1 && (
          <div className="font-ink flex shrink-0 items-center gap-1 text-base text-[#6b665c]">
            <button type="button" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous page" className="ink-focus grid h-9 w-9 place-items-center rounded-full disabled:opacity-30">
              <Arrow dir={-1} />
            </button>
            <span className="tabular-nums" aria-live="polite">
              {at + 1} / {works.length}
            </span>
            <button type="button" onClick={() => go(at + 1)} disabled={at === works.length - 1} aria-label="Next page" className="ink-focus grid h-9 w-9 place-items-center rounded-full disabled:opacity-30">
              <Arrow dir={1} />
            </button>
          </div>
        )}
      </div>

      <div
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => {
          swipe.current = (e.target as HTMLElement).closest("[data-no-swipe]") ? null : { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
            swiped.current = true;
            go(at + (dx < 0 ? 1 : -1));
          }
        }}
        onPointerCancel={() => {
          swipe.current = null;
        }}
        onClickCapture={(e) => {
          // a mouse swipe across the video mustn't also play it
          if (!swiped.current) return;
          swiped.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={work.slug}
            custom={dir}
            variants={flip}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0 : 0.22, ease: EASE }}
          >
            {vertical ? (
              <div className="flex flex-col gap-5">
                {video ? <InkVideo video={video} title={work.title} maxHeight={VIDEO_MAX.tall} /> : <NoVideo />}
                <Notes work={work} video={video} />
              </div>
            ) : (
              <div className="grid grid-cols-[minmax(200px,280px)_1fr]">
                <div className="relative pr-8">
                  <Notes work={work} video={video} />
                  {/* the fold between the leaves */}
                  <span
                    aria-hidden
                    className="absolute -right-3 top-0 h-full w-6"
                    style={{ background: "linear-gradient(to right, rgba(120, 92, 54, 0), rgba(120, 92, 54, 0.14) 50%, rgba(120, 92, 54, 0))" }}
                  />
                </div>
                <div className="flex min-w-0 items-center justify-center pl-8">
                  {video ? <InkVideo video={video} title={work.title} maxHeight={VIDEO_MAX.wide} /> : <NoVideo />}
                </div>
              </div>
            )}

            {ae && (
              <div className="mt-8 border-t border-[#c9b896]/70 pt-6">
                <AeProjectCard title={AE_TITLE} info={ae.info} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {works.length > 1 && (
        <div className="mt-6 flex justify-center gap-1">
          {works.map((w, i) => (
            <button
              key={w.slug}
              type="button"
              onClick={() => go(i)}
              aria-label={`Page ${i + 1}: ${w.title}`}
              aria-current={i === at ? "page" : undefined}
              className="ink-focus grid h-7 w-7 place-items-center rounded-full"
            >
              <span className={`block rounded-full ${i === at ? "h-2.5 w-2.5 bg-[#2f2c27]" : "h-2 w-2 border border-[#2f2c27]/50"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
