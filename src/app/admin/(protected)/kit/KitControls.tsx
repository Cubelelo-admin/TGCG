"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postKit } from "./ScanInput";

export function GenerateBoxesButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (!confirm("Create boxes for every paid runner who has none yet? Runners already boxed are left alone.")) return;
    setBusy(true);
    setMsg(null);
    const res = await postKit<{ bags?: number; groupBoxes?: number }>({ action: "generate", eventId });
    setBusy(false);
    setMsg(res.ok ? `Created ${res.bags} expo bags and ${res.groupBoxes} group boxes` : (res.message ?? "Failed"));
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-neutral-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? "Generating..." : "Generate boxes"}
      </button>
      {msg && <p className="mt-2 text-sm text-neutral-300">{msg}</p>}
    </div>
  );
}

export function ChannelToggle({
  eventId,
  pocName,
  corporate,
  total,
}: {
  eventId: string;
  pocName: string;
  corporate: number;
  total: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const isCorporate = corporate > 0;

  async function toggle() {
    setBusy(true);
    setMsg(null);
    const res = await postKit({
      action: "set-channel",
      eventId,
      pocName,
      channel: isCorporate ? "expo" : "corporate",
    });
    setBusy(false);
    if (!res.ok) setMsg(res.message ?? "Failed");
    else if (res.message) setMsg(res.message);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          isCorporate ? "bg-sky-500/20 text-sky-300" : "bg-white/10 text-neutral-300"
        }`}
      >
        {isCorporate ? `Corporate (${corporate}/${total})` : "Expo"}
      </span>
      <button
        onClick={toggle}
        disabled={busy}
        className="text-xs underline decoration-white/30 hover:decoration-white disabled:opacity-50"
      >
        {isCorporate ? "Move to expo" : "Make corporate (day 0)"}
      </button>
      {msg && <span className="text-xs text-amber-300">{msg}</span>}
    </div>
  );
}
