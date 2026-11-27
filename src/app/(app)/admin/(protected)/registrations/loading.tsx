export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="h-7 w-48 rounded bg-white/10" />
        <div className="h-9 w-28 rounded-full bg-white/10" />
      </div>
      <div className="mt-6 h-10 w-full max-w-2xl rounded-lg bg-white/[0.04]" />
      <div className="mt-6 h-[420px] rounded-xl border border-white/10 bg-white/[0.03]" />
    </div>
  );
}
