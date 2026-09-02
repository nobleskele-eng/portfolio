// Number of placeholder cards to render per subsection until real
// project data exists.
const PLACEHOLDER_CARDS = 3;

function ProjectGrid() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: PLACEHOLDER_CARDS }).map((_, i) => (
        <li
          key={i}
          className="flex min-h-[200px] flex-col justify-between rounded-xl border border-dashed border-neutral-400 p-5"
        >
          <div className="aspect-video w-full rounded-lg bg-neutral-200" />
          <span className="mt-4 text-sm font-medium">[NEEDS PROJECT DATA]</span>
        </li>
      ))}
    </ul>
  );
}

export default function Projects() {
  return (
    <section
      aria-label="Projects"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
    >
      <h2 className="placeholder-label mb-10 text-sm">[NEEDS COPY — section heading]</h2>

      <div className="space-y-16">
        <div>
          <h3 className="mb-6 text-lg font-semibold">Editing</h3>
          <ProjectGrid />
        </div>

        <div>
          <h3 className="mb-6 text-lg font-semibold">Web Dev/Design</h3>
          <ProjectGrid />
        </div>
      </div>
    </section>
  );
}
