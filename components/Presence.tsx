const PRESENCE_CARDS = ["[SPOTIFY]", "[DISCORD]", "[CLAUDE CODE]", "[AFTER EFFECTS]"];

export default function Presence() {
  return (
    <section
      aria-label="Presence"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
    >
      <h2 className="placeholder-label mb-8 text-sm">[NEEDS COPY — section heading]</h2>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRESENCE_CARDS.map((label) => (
          <li
            key={label}
            className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-neutral-400 p-6 text-center text-sm font-medium"
          >
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
