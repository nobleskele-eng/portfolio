"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * A paper scroll that unrolls over the scene: a horizontal handscroll between
 * two wooden rollers on wide screens, a hanging scroll on phones. Modal: focus
 * is trapped inside, Esc or a click outside rolls it back up.
 */

const EASE = [0.22, 0.8, 0.3, 1] as const;

function Roller({ along }: { along: "x" | "y" }) {
  // `along` is the axis the paper unrolls on; the rod runs across it.
  const vertical = along === "x";
  return (
    <div
      aria-hidden
      className={vertical ? "relative -my-3 w-3.5 shrink-0" : "relative -mx-3 h-3.5 shrink-0"}
      style={{
        borderRadius: 999,
        background: vertical
          ? "linear-gradient(to right, #3f2817, #8a5a34 45%, #5b3a22 70%, #2f1d10)"
          : "linear-gradient(to bottom, #3f2817, #8a5a34 45%, #5b3a22 70%, #2f1d10)",
        boxShadow: "0 2px 6px rgba(40, 26, 12, 0.35)",
      }}
    >
      {[0, 1].map((end) => (
        <span
          key={end}
          className="absolute rounded-full"
          style={{
            width: 18,
            height: 18,
            background: "radial-gradient(circle at 35% 35%, #c9a46a, #7a4e2b 70%)",
            ...(vertical
              ? { left: "50%", marginLeft: -9, [end ? "bottom" : "top"]: -9 }
              : { top: "50%", marginTop: -9, [end ? "right" : "left"]: -9 }),
          }}
        />
      ))}
    </div>
  );
}

export default function ScrollPanel({
  open,
  vertical,
  wide = false,
  labelledBy,
  onClose,
  children,
}: {
  open: boolean;
  /** hanging scroll (phones) instead of a handscroll */
  vertical: boolean;
  /** a longer handscroll, for panels with more to show */
  wide?: boolean;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => closeRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const unroll = vertical
    ? { initial: { height: 0 }, animate: { height: "auto" }, exit: { height: 0 } }
    : { initial: { width: 0 }, animate: { width: "auto" }, exit: { width: 0 } };
  const duration = reduced ? 0 : 0.7;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scroll"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          onKeyDown={onKeyDown}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "rgba(52, 40, 26, 0.3)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.35 }}
            onClick={onClose}
          />

          <motion.div
            className={`relative flex ${vertical ? "flex-col items-stretch" : "flex-row items-stretch"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { delay: duration * 0.8, duration: 0.15 } }}
            transition={{ duration: reduced ? 0 : 0.15 }}
          >
            <Roller along={vertical ? "y" : "x"} />
            <motion.div
              className="overflow-hidden"
              {...unroll}
              transition={{ duration, ease: EASE }}
            >
              <div
                className={
                  vertical
                    ? "ink-paper relative w-[min(84vw,420px)] max-h-[72svh] overflow-y-auto px-6 py-7"
                    : `ink-paper relative ${wide ? "w-[min(780px,calc(100vw-96px))]" : "w-[min(640px,calc(100vw-96px))]"} max-h-[78svh] overflow-y-auto px-10 py-9`
                }
              >
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="ink-focus absolute right-3 top-2 grid h-10 w-10 place-items-center rounded-full text-2xl leading-none text-[#4a4640] hover:text-[#1f1d1a]"
                >
                  ×
                </button>
                {children}
              </div>
            </motion.div>
            <Roller along={vertical ? "y" : "x"} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
