"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-neutral-950 hover:bg-emerald-400"
    >
      Print
    </button>
  );
}
