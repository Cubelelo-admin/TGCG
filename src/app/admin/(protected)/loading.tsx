export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-56 rounded bg-white/10" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-20 rounded-xl border border-white/10 bg-white/[0.03]" />
        <div className="h-20 rounded-xl border border-white/10 bg-white/[0.03]" />
      </div>
      <div className="mt-10 h-6 w-32 rounded bg-white/10" />
      <div className="mt-4 h-48 rounded-xl border border-white/10 bg-white/[0.03]" />
    </div>
  );
}
