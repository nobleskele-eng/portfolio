// Solid-fill stand-in for the future 1000x2000 illustration. Intrinsic
// dimensions keep the 1:2 aspect ratio even before the real asset lands.
const LANDING_ART_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1000'%20height='2000'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23c9d6e4'/%3E%3C/svg%3E";

// Ink colour shared with the hand-drawn Presence cards.
const SKETCH_INK = "#111";
const HAND = "'Caveat', ui-sans-serif, cursive";

/** Hand-drawn sketch icons — self-contained inline SVGs (own filter/pattern
 *  ids), lifted from the same feTurbulence-wobble technique as Presence.tsx. */
function TikTokIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" style={{ overflow: "visible" }} aria-hidden>
      <defs>
        <filter id="w-tt" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.12" numOctaves={2} seed={11} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2.6} />
        </filter>
        <filter id="w-tt-tight" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.22" numOctaves={2} seed={4} result="n2" />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale={1.4} />
        </filter>
        <pattern id="h-tt" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={6} stroke={SKETCH_INK} strokeWidth={1} />
        </pattern>
      </defs>
      <path d="M30,9 L44,9 C49,9 52,13 52,19 C52,25 48,29 42,29 C38,29 35,27 35,23 L35,31 L30,31 Z" fill="none" stroke={SKETCH_INK} strokeWidth={2} strokeLinejoin="round" filter="url(#w-tt)" />
      <circle cx="24" cy="41" r="11" fill="url(#h-tt)" opacity={0.5} filter="url(#w-tt-tight)" />
      <circle cx="24" cy="41" r="11" fill="none" stroke={SKETCH_INK} strokeWidth={2.2} filter="url(#w-tt)" />
      <circle cx="24" cy="41" r="10" fill="none" stroke={SKETCH_INK} strokeWidth={1} opacity={0.5} filter="url(#w-tt)" />
      <circle cx="24" cy="41" r="5" fill="#fff" stroke={SKETCH_INK} strokeWidth={1.6} filter="url(#w-tt-tight)" />
    </svg>
  );
}

function PayhipIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" style={{ overflow: "visible" }} aria-hidden>
      <defs>
        <filter id="w-ph" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.12" numOctaves={2} seed={21} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2.6} />
        </filter>
        <filter id="w-ph-tight" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.22" numOctaves={2} seed={8} result="n2" />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale={1.4} />
        </filter>
        <pattern id="h-ph" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={6} stroke={SKETCH_INK} strokeWidth={1} />
        </pattern>
      </defs>
      <path d="M13,26 L20,14 L44,14 L51,26 Z" fill="none" stroke={SKETCH_INK} strokeWidth={2} strokeLinejoin="round" filter="url(#w-ph)" />
      <path d="M13,26 L20,26 M27.3,26 L34.7,26 M42,26 L51,26" fill="none" stroke={SKETCH_INK} strokeWidth={1.4} filter="url(#w-ph-tight)" />
      <path d="M20,14 L20.5,26 M32,14 L32,26 M44,14 L43.5,26" fill="none" stroke={SKETCH_INK} strokeWidth={1} opacity={0.5} filter="url(#w-ph-tight)" />
      <rect x="15" y="26" width="34" height="24" fill="none" stroke={SKETCH_INK} strokeWidth={2} filter="url(#w-ph)" />
      <rect x="18" y="30" width="8" height="8" fill="url(#h-ph)" opacity={0.5} stroke={SKETCH_INK} strokeWidth={1.2} filter="url(#w-ph-tight)" />
      <rect x="38" y="30" width="8" height="8" fill="url(#h-ph)" opacity={0.5} stroke={SKETCH_INK} strokeWidth={1.2} filter="url(#w-ph-tight)" />
      <rect x="28" y="36" width="8" height="14" fill="none" stroke={SKETCH_INK} strokeWidth={1.6} filter="url(#w-ph-tight)" />
      <circle cx="34" cy="43" r="0.8" fill={SKETCH_INK} />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" style={{ overflow: "visible" }} aria-hidden>
      <defs>
        <filter id="w-sp" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.12" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2.6} />
        </filter>
        <filter id="w-sp-tight" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.22" numOctaves={2} seed={3} result="n2" />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale={1.4} />
        </filter>
        <pattern id="h-sp" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={6} stroke={SKETCH_INK} strokeWidth={1} />
        </pattern>
        <clipPath id="c-sp">
          <circle cx="32" cy="32" r="20" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="20" fill="none" stroke={SKETCH_INK} strokeWidth={2} filter="url(#w-sp)" />
      <circle cx="32" cy="32" r="19" fill="none" stroke={SKETCH_INK} strokeWidth={1} opacity={0.5} filter="url(#w-sp)" />
      <circle cx="32" cy="32" r="13" fill="none" stroke={SKETCH_INK} strokeWidth={1} filter="url(#w-sp-tight)" />
      <circle cx="32" cy="32" r="7" fill="url(#h-sp)" stroke={SKETCH_INK} strokeWidth={1.4} filter="url(#w-sp-tight)" />
      <circle cx="32" cy="32" r="1.6" fill={SKETCH_INK} />
      <rect x="32" y="20" width="12" height="14" fill="#fff" stroke={SKETCH_INK} strokeWidth={1.6} transform="rotate(-6 38 27)" clipPath="url(#c-sp)" filter="url(#w-sp-tight)" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" style={{ overflow: "visible" }} aria-hidden>
      <defs>
        <filter id="w-gh" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.12" numOctaves={2} seed={15} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2.6} />
        </filter>
        <filter id="w-gh-tight" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.22" numOctaves={2} seed={9} result="n2" />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale={1.4} />
        </filter>
        <pattern id="h-gh" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={6} stroke={SKETCH_INK} strokeWidth={1} />
        </pattern>
      </defs>
      <circle cx="32" cy="32" r="27" fill="none" stroke={SKETCH_INK} strokeWidth={2} filter="url(#w-gh)" />
      <circle cx="32" cy="32" r="26" fill="none" stroke={SKETCH_INK} strokeWidth={1} opacity={0.4} filter="url(#w-gh)" />
      <path d="M24,17 Q18,6 30,15" fill="none" stroke={SKETCH_INK} strokeWidth={1.8} strokeLinecap="round" filter="url(#w-gh-tight)" />
      <path d="M40,17 Q46,6 34,15" fill="none" stroke={SKETCH_INK} strokeWidth={1.8} strokeLinecap="round" filter="url(#w-gh-tight)" />
      <circle cx="32" cy="27" r="13" fill="url(#h-gh)" opacity={0.3} stroke={SKETCH_INK} strokeWidth={2} filter="url(#w-gh)" />
      <circle cx="27" cy="26" r="1.5" fill={SKETCH_INK} />
      <circle cx="37" cy="26" r="1.5" fill={SKETCH_INK} />
      <path d="M20,32 C19,40 22,45 27,47 C29,47.5 30,48 30,51 L30,57" fill="none" stroke={SKETCH_INK} strokeWidth={2} filter="url(#w-gh)" />
      <path d="M44,32 C45,40 42,45 37,47 C35,47.5 34,48 34,51 L34,57" fill="none" stroke={SKETCH_INK} strokeWidth={2} filter="url(#w-gh)" />
      <path d="M19,38 C12,37 9,42 12,47 C14,50 19,49 21,45" fill="none" stroke={SKETCH_INK} strokeWidth={1.8} filter="url(#w-gh-tight)" />
    </svg>
  );
}

// Link pills that "land" with the character near the bottom of the hero.
const LANDING_LINKS: {
  label: string;
  href: string;
  Icon: () => React.ReactElement;
  wobbleId: string;
}[] = [
  { label: "TikTok", href: "https://www.tiktok.com/@stayvyxed", Icon: TikTokIcon, wobbleId: "w-tt" },
  { label: "Payhip", href: "https://payhip.com/vyxed", Icon: PayhipIcon, wobbleId: "w-ph" },
  {
    label: "Spotify",
    href: "https://open.spotify.com/user/5w9i588o65evpo62d09i3ekuc?si=fed9d08ff0d94316",
    Icon: SpotifyIcon,
    wobbleId: "w-sp",
  },
  { label: "GitHub", href: "https://github.com/nobleskele-eng", Icon: GitHubIcon, wobbleId: "w-gh" },
];

export default function Landing() {
  return (
    <section
      aria-label="Landing"
      className="relative w-full overflow-hidden aspect-[1/2]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LANDING_ART_PLACEHOLDER}
        alt="[LANDING ART — character falling through clouds, top to bottom]"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Visible label for the missing art asset. */}
      <p className="placeholder-label absolute left-1/2 top-6 w-[90%] -translate-x-1/2 text-center leading-relaxed">
        [LANDING ART — character falling through clouds, top to bottom]
      </p>

      {/* Links live INSIDE the hero, in the bottom ~18% where the
          character lands. */}
      <div className="absolute inset-x-0 bottom-0 flex h-[18%] flex-col items-center justify-center px-4">
        <ul className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {LANDING_LINKS.map(({ label, href, Icon, wobbleId }) => (
            <li key={href}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="group relative inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5"
                style={{ color: SKETCH_INK, fontFamily: HAND }}
              >
                {/* hand-drawn double border — wobbled by this link's own icon filter */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ filter: `url(#${wobbleId})` }}
                >
                  <span
                    className="absolute inset-0 rounded-[10px] border-2 bg-white/75 transition-colors group-hover:bg-white"
                    style={{ borderColor: SKETCH_INK }}
                  />
                  <span
                    className="absolute inset-[3px] rounded-[9px] border"
                    style={{ borderColor: SKETCH_INK, opacity: 0.5 }}
                  />
                </span>

                <span className="relative flex items-center">
                  <Icon />
                </span>
                <span
                  className="relative text-[17px] font-bold leading-none sm:text-[19px]"
                >
                  {label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
