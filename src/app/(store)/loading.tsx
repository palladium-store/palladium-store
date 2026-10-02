export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-3 w-24 animate-pulse bg-line" />
      <div className="mt-3 h-9 w-64 animate-pulse bg-line" />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] animate-pulse bg-bone" />
            <div className="mt-3 h-3 w-16 animate-pulse bg-line" />
            <div className="mt-2 h-4 w-3/4 animate-pulse bg-line" />
            <div className="mt-2 h-4 w-16 animate-pulse bg-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
