"use client";

import { useEffect, useState } from "react";

/**
 * Hand-drawn chibi that perches on the top edge of a presence card while that
 * service is idle / offline (or, for Claude Code, types while a session runs).
 *
 * This component only renders the drawing — the parent positions it straddling
 * the card's top border. The typing frames are all the same canvas size and are
 * registered on the glasses, so the stop-motion loop shows only the hair /
 * hands moving — no zoom or drift.
 */

const TYPING_FRAMES = [
  "/presence/typing-1.png",
  "/presence/typing-2.png",
  "/presence/typing-3.png",
  "/presence/typing-4.png",
];

const SLEEPING_FRAMES = [
  "/presence/sleeping-1.png",
  "/presence/sleeping-2.png",
  "/presence/sleeping-3.png",
  "/presence/sleeping-4.png",
];

// ms per frame for the typing stop-motion.
const TYPING_FRAME_MS = 130;

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

export default function PresenceMascot({
  variant,
  /** which sleeping frame to hold (0–3); ignored for typing */
  sleepingFrame = 3,
  /** rendered width in px */
  size = 84,
}: {
  variant: "sleeping" | "typing";
  sleepingFrame?: number;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (variant !== "typing" || reduced) return;
    const id = setInterval(
      () => setI((n) => (n + 1) % TYPING_FRAMES.length),
      TYPING_FRAME_MS
    );
    return () => clearInterval(id);
  }, [variant, reduced]);

  const src =
    variant === "typing"
      ? TYPING_FRAMES[reduced ? 0 : i]
      : SLEEPING_FRAMES[Math.max(0, Math.min(3, sleepingFrame))];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      style={{ display: "block", width: size, height: "auto" }}
    />
  );
}
