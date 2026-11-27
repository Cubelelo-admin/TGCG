/** Dock skeleton: page header, a KPI row and a table card, in neutral grey blocks. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      {/* PageHeader: 20/26 title + 14px subtitle on the left, an action on the right */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-[26px] w-56 rounded-6 bg-surface-tertiary" />
          <div className="mt-2 h-[18px] w-72 max-w-full rounded-6 bg-surface-tertiary" />
        </div>
        <div className="h-9 w-28 shrink-0 rounded-6 bg-surface-tertiary" />
      </div>

      {/* KpiRow */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="min-h-[140px] rounded-16 border border-line-secondary bg-white p-4 shadow-card">
            <div className="h-[18px] w-24 rounded-6 bg-surface-tertiary" />
            <div className="mt-4 h-10 w-20 rounded-6 bg-surface-tertiary" />
          </div>
        ))}
      </div>

      {/* Card with a DataTable */}
      <div className="mt-6 rounded-8 bg-white p-5 shadow-card">
        <div className="h-6 w-40 rounded-6 bg-surface-tertiary" />
        <div className="mt-4 overflow-hidden rounded-8 border border-line">
          <div className="h-10 bg-surface-tertiary" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex h-12 items-center gap-4 border-t border-alpha-4 px-3">
              <div className="h-3 w-24 rounded-4 bg-surface-tertiary" />
              <div className="h-3 flex-1 rounded-4 bg-surface-tertiary" />
              <div className="h-3 w-16 rounded-4 bg-surface-tertiary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
