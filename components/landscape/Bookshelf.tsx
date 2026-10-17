"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PROJECTS_TITLE, SHELF_HINT, SHELVES, WORKS, type ShelfId } from "@/content/projects";
import { HEADING } from "./heading";
import { INK } from "./LinkIcons";

/**
 * The bookshelf's first page: one ink book per volume standing on a plank.
 * Hovering one tips it up off the shelf; picking it slides it out, then the
 * album opens.
 */

// Each spine's height (share of the shelf), width and wash, so the row isn't machine-even.
const SPINES = [
  { h: 0.92, w: 66, wash: 0.07 },
  { h: 1, w: 76, wash: 0.15 },
  { h: 0.86, w: 68, wash: 0.04 },
  { h: 0.95, w: 62, wash: 0.11 },
];
// the spines' drawing space; stretched to whatever size the button is
const VW = 64;
const VH = 260;

/** A book's outline: hand-drawn sides and a slightly domed top. */
function spinePath(seed: number) {
  const j = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * 1.4;
  return [
    `M${2 + j(1)} ${6 + j(2)}`,
    `Q${VW / 2} ${1 + j(3)} ${VW - 2 + j(4)} ${6 + j(5)}`,
    `L${VW - 2.5 + j(6)} ${VH - 2}`,
    `Q${VW / 2} ${VH - 0.5 + j(7) * 0.4} ${2.5 + j(8)} ${VH - 2}`,
    "Z",
  ].join(" ");
}

/** A pair of tooled bands across the spine at height y. */
const band = (y: number, seed: number) => {
  const j = (k: number) => Math.sin(seed * 7.13 + k * 3.71) * 0.8;
  return `M5 ${y + j(1)} L${VW - 5} ${y + j(2)} M5 ${y + 5 + j(3)} L${VW - 5} ${y + 5 + j(4)}`;
};

function Spine({ i }: { i: number }) {
  const s = SPINES[i];
  const d = spinePath(i + 1);
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      <path d={d} fill="#f7eedb" />
      <path d={d} fill={INK} fillOpacity={s.wash} />
      <g filter="url(#ink-edge)" fill="none" stroke={INK} vectorEffect="non-scaling-stroke">
        <path d={d} strokeOpacity={0.85} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
        <path d={band(22, i)} strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={band(VH - 34, i + 5)} strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

export default function Bookshelf({
  titleId,
  focusShelf,
  onPick,
}: {
  titleId: string;
  /** the volume just closed, to hand focus back to */
  focusShelf: ShelfId | null;
  onPick: (shelf: ShelfId) => void;
}) {
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<ShelfId | null>(null);
  const buttons = useRef<Partial<Record<ShelfId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (focusShelf) buttons.current[focusShelf]?.focus();
  }, [focusShelf]);

  function pick(id: ShelfId) {
    if (picked) return;
    setPicked(id);
    setTimeout(() => onPick(id), reduced ? 0 : 240);
  }

  return (
    <>
      <h2 id={titleId} className={`${HEADING} !mb-1`}>
        {PROJECTS_TITLE}
      </h2>
      <p className="font-ink mb-6 text-base italic text-[#6b665c]">{SHELF_HINT}</p>

      <div className="relative mx-auto max-w-[520px]">
        {/* as tall as the scroll leaves room for, under its title */}
        <div className="flex h-[clamp(130px,calc(72svh-210px),230px)] items-end justify-center gap-2 px-2 sm:h-[clamp(130px,calc(78svh-230px),270px)] sm:gap-3">
          {SHELVES.map((shelf, i) => {
            const count = WORKS.filter((w) => w.shelf === shelf.id).length;
            const s = SPINES[i % SPINES.length];
            return (
              <motion.div
                key={shelf.id}
                className="h-full min-w-0"
                style={{ flex: `0 1 ${s.w}px`, display: "flex", alignItems: "flex-end" }}
                animate={picked === shelf.id ? { y: -36, opacity: 0 } : { y: 0, opacity: picked ? 0.55 : 1 }}
                transition={{ duration: reduced ? 0 : 0.24, ease: [0.22, 0.8, 0.3, 1] }}
              >
                <motion.button
                  ref={(el) => {
                    buttons.current[shelf.id] = el;
                  }}
                  type="button"
                  disabled={count === 0}
                  onClick={() => pick(shelf.id)}
                  aria-label={count ? `${shelf.title}, ${count} ${count === 1 ? "work" : "works"}` : `${shelf.title}, coming soon`}
                  className="ink-focus relative w-full disabled:cursor-default"
                  style={{ height: `${s.h * 100}%`, transformOrigin: "50% 100%" }}
                  whileHover={reduced || count === 0 ? undefined : { y: -10, rotate: -2.5 }}
                  whileFocus={reduced || count === 0 ? undefined : { y: -10, rotate: -2.5 }}
                  whileTap={reduced ? undefined : { y: -4 }}
                  transition={{ type: "spring", stiffness: 420, damping: 24 }}
                >
                  <Spine i={i} />
                  <span
                    className="font-ink absolute inset-x-0 top-[13%] bottom-[24%] flex items-center justify-center text-lg tracking-[0.14em] text-[#2f2c27] sm:text-xl"
                    style={{ writingMode: "vertical-rl" }}
                  >
                    {shelf.title}
                  </span>
                  <span
                    aria-hidden
                    className="font-ink absolute bottom-[6%] left-1/2 rounded-[3px] px-1.5 text-sm leading-snug text-[#f6ecd9]"
                    style={{
                      background: count ? "var(--seal)" : "rgba(47, 44, 39, 0.35)",
                      transform: "translateX(-50%) rotate(-4deg)",
                      boxShadow: "inset 0 0 0 1.5px rgba(246, 236, 217, 0.55)",
                    }}
                  >
                    {count || "soon"}
                  </span>
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {/* the plank the books stand on */}
        <svg aria-hidden className="block h-4 w-full" viewBox="0 0 520 16" preserveAspectRatio="none">
          <g filter="url(#ink-edge)">
            <path d="M2 4 Q130 2.4 260 3.4 T518 3.2 L517 10.5 Q260 12.2 3 10.8 Z" fill={INK} fillOpacity={0.82} />
            <path d="M8 13.5 Q260 15.2 512 13.6" fill="none" stroke={INK} strokeOpacity={0.3} strokeWidth={1.2} />
          </g>
        </svg>
      </div>
    </>
  );
}
