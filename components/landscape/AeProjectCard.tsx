import type { AeLayer, AeProjectInfo } from "@/content/after-effects";
import { INK } from "./LinkIcons";

// The timeline shows at most this many layers (the top of the stack).
const ROWS = 18;
const TOP_EFFECTS = 8;

function clock(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const num = (n: number) => n.toLocaleString("en-US");

// 60.002 → "60", 23.976 stays as it is
const fps = (f: number) => (Math.abs(f - Math.round(f)) < 0.01 ? String(Math.round(f)) : String(f));

// a pseudo effect (an expression-controls preset) can have no display name
const effectName = (e: AeProjectInfo["effects"][number]) => e.name || e.matchName.replace(/^Pseudo\//, "");

// How dark each kind of layer is inked: footage and precomps darkest, helpers faint.
const TONE: Record<string, number> = {
  video: 0.85,
  precomp: 0.8,
  image: 0.7,
  text: 0.75,
  shape: 0.6,
  solid: 0.5,
  adjustment: 0.35,
  audio: 0.3,
  null: 0.25,
  camera: 0.25,
  light: 0.25,
};

/** A wobbly brush bar from x0 to x1, its ends tapered like a stroke. */
function barPath(x0: number, x1: number, y: number, h: number, seed: number) {
  const w = Math.max(1.5, x1 - x0);
  const wob = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * 0.35;
  const t = Math.min(h * 0.9, w / 2);
  return [
    `M${x0} ${y + h / 2}`,
    `Q${x0 + t * 0.3} ${y + wob(1)} ${x0 + t} ${y + wob(2)}`,
    `L${x0 + w - t} ${y + wob(3)}`,
    `Q${x0 + w} ${y + h * 0.2} ${x0 + w + 0.6} ${y + h / 2}`,
    `Q${x0 + w} ${y + h * 0.85} ${x0 + w - t} ${y + h + wob(4)}`,
    `L${x0 + t} ${y + h + wob(5)}`,
    `Q${x0 + t * 0.3} ${y + h + wob(6)} ${x0} ${y + h / 2}`,
    "Z",
  ].join(" ");
}

function layerTitle(l: AeLayer) {
  const bits = [`${l.name} (${l.kind})`, `${clock(l.in)}–${clock(l.out)}`];
  if (l.effects.length) bits.push(l.effects.join(", "));
  if (l.keyframes) bits.push(`${l.keyframes} keyframes`);
  return bits.join(" · ");
}

/** The main comp's layer stack as ink bars over time. */
function Timeline({ main }: { main: NonNullable<AeProjectInfo["main"]> }) {
  const rows = main.layers.slice(0, ROWS);
  const W = 520;
  const rowH = 7;
  const gap = 2.5;
  const top = 4;
  const H = top + rows.length * (rowH + gap) + 6;
  const x = (t: number) => (t / main.duration) * W;
  const step = main.duration > 90 ? 30 : main.duration > 40 ? 10 : main.duration > 12 ? 5 : 1;
  const ticks: number[] = [];
  for (let t = 0; t <= main.duration + 0.001; t += step) ticks.push(t);
  return (
    <div className="mt-3">
      <svg
        viewBox={`-2 0 ${W + 6} ${H}`}
        className="block w-full"
        role="img"
        aria-label={`Timeline of "${main.comp}": ${main.totalLayers} layers over ${clock(main.duration)}`}
      >
        <g filter="url(#ink-edge)">
          {rows.map((l, i) => {
            const y = top + i * (rowH + gap);
            return (
              <path
                key={i}
                d={barPath(x(l.in), x(l.out), y, rowH, i + 1)}
                fill={INK}
                fillOpacity={(TONE[l.kind] ?? 0.55) * (l.enabled ? 1 : 0.35)}
              >
                <title>{layerTitle(l)}</title>
              </path>
            );
          })}
        </g>
      </svg>
      {/* time labels in HTML so they stay readable however small the timeline gets */}
      <div aria-hidden className="relative h-5 border-t border-[#2f2c27]/25 text-[11px] text-[#8a8478]">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute top-0.5 border-l border-[#2f2c27]/30 pl-1 leading-none"
            style={{ left: `${(t / main.duration) * 100}%`, transform: t >= main.duration - step / 2 && t > 0 ? "translateX(-100%)" : undefined }}
          >
            {clock(t)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AeProjectCard({ title, info }: { title: string; info: AeProjectInfo }) {
  const m = info.main;
  const c = info.counts;
  const stats: [string, number][] = [
    ["comps", c.comps],
    ["layers", c.layers],
    ["keyframes", c.keyframes],
    ["expressions", c.expressions],
    ["effects", c.effects],
  ];
  return (
    <article className="font-ink">
      <h4 className="text-xl font-medium text-[#2f2c27]">{title}</h4>
      {m && (
        <p className="text-sm text-[#6b665c]">
          {m.width}×{m.height} · {fps(m.fps)} fps · {clock(m.duration)} · main comp “{m.comp}”
        </p>
      )}
      {m && m.layers.length > 0 && <Timeline main={m} />}
      {m && m.totalLayers > ROWS && (
        <p className="text-xs text-[#8a8478]">top {ROWS} of {m.totalLayers} layers</p>
      )}
      <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-3 text-center sm:grid-cols-5">
        {stats.map(([label, n]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-[#8a8478]">{label}</dt>
            <dd className="text-lg leading-tight text-[#2f2c27]">{num(n)}</dd>
          </div>
        ))}
      </dl>
      {info.effects.length > 0 && (
        <p className="mt-3 text-[15px] leading-relaxed text-[#4a463f]">
          <span className="text-[#8a8478]">effects </span>
          {info.effects
            .slice(0, TOP_EFFECTS)
            .map((e) => `${effectName(e)}${e.count > 1 ? ` ×${e.count}` : ""}`)
            .join(" · ")}
          {info.effects.length > TOP_EFFECTS && <span className="text-[#8a8478]"> +{info.effects.length - TOP_EFFECTS} more</span>}
        </p>
      )}
      {info.fonts.length > 0 && (
        <p className="mt-1 text-[15px] leading-relaxed text-[#4a463f]">
          <span className="text-[#8a8478]">fonts </span>
          {info.fonts.map((f) => (f.style && f.style !== "Regular" ? `${f.family} ${f.style}` : f.family)).join(" · ")}
        </p>
      )}
    </article>
  );
}
