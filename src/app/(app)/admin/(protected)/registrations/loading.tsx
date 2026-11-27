export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading registrations">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="h-[26px] w-56 rounded-6 bg-surface-tertiary" />
          <div className="mt-1 h-[18px] w-72 rounded-6 bg-surface-tertiary" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-6 bg-surface-tertiary" />
          <div className="h-9 w-28 rounded-6 bg-surface-tertiary" />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[140px] min-w-[220px] flex-1 rounded-16 bg-surface-tertiary" />
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2 rounded-8 bg-white px-4 py-3 shadow-card">
        <div className="h-9 w-full min-w-0 rounded-6 bg-surface-tertiary sm:w-auto sm:min-w-[280px] sm:flex-1" />
        <div className="h-9 w-40 rounded-6 bg-surface-tertiary" />
        <div className="h-9 w-32 rounded-6 bg-surface-tertiary" />
        <div className="h-9 w-44 rounded-6 bg-surface-tertiary" />
        <div className="h-9 w-20 rounded-6 bg-surface-tertiary" />
      </div>
      <div className="overflow-hidden rounded-8 border border-line">
        <div className="h-10 bg-surface-tertiary" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-alpha-4 bg-white px-3 py-3">
            <div className="h-3 w-24 rounded-4 bg-surface-tertiary" />
            <div className="h-3 w-40 rounded-4 bg-surface-tertiary" />
            <div className="h-3 flex-1 rounded-4 bg-surface-tertiary" />
            <div className="h-5 w-14 rounded-4 bg-surface-tertiary" />
          </div>
        ))}
      </div>
    </div>
  );
}
