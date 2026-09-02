// Solid-fill stand-in for the future 1000x2000 illustration. Intrinsic
// dimensions keep the 1:2 aspect ratio even before the real asset lands.
const LANDING_ART_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1000'%20height='2000'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23c9d6e4'/%3E%3C/svg%3E";

// Placeholder link pills that "land" with the character near the bottom
// of the hero. Real links replace these later.
const LANDING_LINKS = ["[LINK]", "[LINK]", "[LINK]", "[LINK]"];

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
      <div className="absolute inset-x-0 bottom-0 flex h-[18%] flex-col items-center justify-center gap-3 px-4">
        <p className="placeholder-label">[NEEDS COPY — link row]</p>
        <ul className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {LANDING_LINKS.map((label, i) => (
            <li key={i}>
              <span className="inline-flex items-center rounded-full border border-neutral-800/70 bg-white/70 px-4 py-2 text-xs font-medium sm:px-6 sm:text-sm">
                {label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
