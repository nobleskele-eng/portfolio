import { moonPath, type SkyState } from "@/lib/sky";

/**
 * The sky's sign: the sun while it's up (or just under the horizon), else the
 * moon in its phase, its unlit side a faint ring. Drawn round the origin of a
 * viewBox of -12 -12 24 24.
 */
export function SkyGlyph({ sky, size, color }: { sky: SkyState; size: number; color: string }) {
  const sunUp = sky.sun.alt > -3;
  return (
    <svg aria-hidden width={size} height={size} viewBox="-12 -12 24 24">
      {sunUp ? (
        <circle r="7" fill={color} />
      ) : (
        <>
          <circle r="7.5" fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={1} />
          <path d={moonPath(7.5, sky.moon.phase)} fill={color} />
        </>
      )}
    </svg>
  );
}
