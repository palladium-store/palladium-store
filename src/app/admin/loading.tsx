export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 animate-pulse bg-line" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse bg-bone" />)}
      </div>
      <div className="h-72 animate-pulse bg-bone" />
    </div>
  );
}
