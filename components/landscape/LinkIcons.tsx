import type { LinkIcon } from "@/content/links";

/*
 * Ink icons: each is a pale wash (bled with a soft filter) under dense brush
 * strokes whose edges are roughened by turbulence, so they read as brushwork
 * on the scroll's paper rather than as flat glyphs. The filters live once in
 * <InkDefs /> and are shared by the link icons and the song player.
 */
export const INK = "#2f2c27";

/** Shared SVG filters; render once per page. */
export function InkDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
      <defs>
        {/* dry-brush edge */}
        <filter id="ink-edge" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale={1.8} result="rough" />
          <feGaussianBlur in="rough" stdDeviation={0.25} />
        </filter>
        {/* ink bleeding into paper */}
        <filter id="ink-bleed" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={3} seed={9} result="blot" />
          <feDisplacementMap in="SourceGraphic" in2="blot" scale={7} result="spread" />
          <feGaussianBlur in="spread" stdDeviation={1.2} />
        </filter>
      </defs>
    </svg>
  );
}

/** Two passes per stroke: a soft wide one and a dense core, like a loaded brush. */
function Brush({ d, w }: { d: string; w: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeOpacity={0.35} strokeWidth={w * 1.45} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={INK} strokeOpacity={0.88} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function Frame({ wash, children }: { wash: React.ReactNode; children: React.ReactNode }) {
  return (
    <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden style={{ overflow: "visible" }}>
      <g filter="url(#ink-bleed)" fill={INK} opacity={0.16}>
        {wash}
      </g>
      <g filter="url(#ink-edge)">{children}</g>
    </svg>
  );
}

function TikTok() {
  const note = "M34 12 C34.6 24 33.4 33 34 43";
  const flag = "M34.2 12.5 C36.5 19.5 41.5 22.5 48.5 22.8";
  const bowl = "M34 43 C33.6 49 29.6 52.5 25.2 52.2 C20.6 51.8 17.2 48.2 17.4 43.6 C17.6 38.6 21.8 35.2 26.4 35.6 C28.6 35.8 30.4 36.6 31.6 37.8";
  return (
    <Frame
      wash={
        <g transform="translate(3 2.5)">
          <path d={`${note} ${flag}`} fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <circle cx={25.6} cy={43.8} r={9} />
        </g>
      }
    >
      <Brush d={note} w={5.2} />
      <Brush d={flag} w={4.4} />
      <Brush d={bowl} w={4.6} />
    </Frame>
  );
}

function Instagram() {
  return (
    <Frame wash={<rect x={10} y={11} width={45} height={44} rx={13} />}>
      <Brush d="M23 11.5 L41 11.2 C48.5 11.2 52.6 15.4 52.6 23 L52.4 41.4 C52.4 48.6 48.2 52.6 41 52.6 L23 52.4 C15.6 52.4 11.4 48.4 11.4 41 L11.6 23 C11.6 15.6 15.8 11.5 23 11.5 Z" w={4.2} />
      <Brush d="M41.6 32 C41.6 37.5 37.4 41.6 32 41.6 C26.6 41.6 22.4 37.4 22.4 32 C22.4 26.6 26.6 22.4 32 22.4 C37.4 22.4 41.6 26.4 41.6 32 Z" w={4} />
      <circle cx={43.6} cy={20.6} r={2.9} fill={INK} fillOpacity={0.9} />
    </Frame>
  );
}

function LastFm() {
  return (
    <Frame wash={<circle cx={32} cy={33} r={25} />}>
      {/* "as", written with a brush */}
      <Brush d="M28.4 29.6 C25.6 25.6 16.2 26 16 34 C15.8 41.6 24.6 43.2 28.2 36.4" w={4} />
      <Brush d="M28.6 27.6 C28 34 28.6 39.6 32 42" w={4} />
      <Brush d="M48.2 28.6 C45 25.6 38.4 26 38.6 30.6 C38.8 35.4 48.4 34 48.2 39.4 C48 44.2 40.6 44.6 37.2 41.4" w={4} />
    </Frame>
  );
}

function GitHub() {
  return (
    <Frame wash={<circle cx={32} cy={32} r={24} />}>
      <Brush d="M32 7.8 C45.6 7.8 56.2 18.6 56.2 32 C56.2 45.4 45.6 56.2 32 56.2 C18.4 56.2 7.8 45.4 7.8 32 C7.8 18.6 18.4 7.8 32 7.8 Z" w={3.2} />
      {/* the cat: head with ears, two legs, the tail curling off to the left */}
      <path
        d="M21.6 31 C20.6 26.4 21.4 22.2 23.4 19 C26.2 21 28.4 22 32 22 C35.6 22 37.8 21 40.6 19 C42.6 22.2 43.4 26.4 42.4 31 C42.4 37.6 37.6 41.6 32 41.6 C26.4 41.6 21.6 37.6 21.6 31 Z"
        fill={INK}
        fillOpacity={0.82}
      />
      <Brush d="M28.4 41 C28.2 45 28.4 49.4 29 53.6" w={3.6} />
      <Brush d="M35.6 41 C35.8 45 35.6 49.4 35 53.6" w={3.6} />
      <Brush d="M28.4 46.8 C22.8 47.8 19.6 45.2 18.4 41.8" w={3.2} />
    </Frame>
  );
}

function Discord() {
  return (
    <Frame
      wash={<path d="M17 20 C24 16.5 28 16 32 16 C36 16 40 16.5 47 20 C51 28 52.6 36 50.6 45 C46.6 48.4 42.6 50 39.6 50.2 L37.2 46 C33.8 47 30.2 47 26.8 46 L24.4 50.2 C21.4 50 17.4 48.4 13.4 45 C11.4 36 13 28 17 20 Z" />}
    >
      <Brush
        d="M17.4 20.4 C24 17 28 16.4 32 16.4 C36 16.4 40 17 46.6 20.4 C50.6 28.2 52.2 36 50.2 44.6 C46.4 47.8 42.6 49.4 39.8 49.6 L37.4 45.6 C33.8 46.8 30.2 46.8 26.6 45.6 L24.2 49.6 C21.4 49.4 17.6 47.8 13.8 44.6 C11.8 36 13.4 28.2 17.4 20.4 Z"
        w={3.8}
      />
      <ellipse cx={25.6} cy={33.6} rx={3.6} ry={4.2} fill={INK} fillOpacity={0.9} />
      <ellipse cx={38.4} cy={33.6} rx={3.6} ry={4.2} fill={INK} fillOpacity={0.9} />
    </Frame>
  );
}

export const LINK_ICONS: Record<LinkIcon, () => React.ReactElement> = {
  tiktok: TikTok,
  instagram: Instagram,
  lastfm: LastFm,
  github: GitHub,
  discord: Discord,
};
