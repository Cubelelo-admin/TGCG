"use client";

import { useCallback, useEffect, useState } from "react";
import ScanInput, { ResultBanner, postKit, type Banner } from "../ScanInput";
import type { KitGroupBoxes } from "@/lib/kit";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";

export default function HandoverStation({ eventId }: { eventId: string }) {
  const [mode, setMode] = useState<"stage" | "handover">("stage");
  const [groups, setGroups] = useState<KitGroupBoxes[]>([]);
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);

  const [group, setGroup] = useState("");
  const [scanned, setScanned] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  const refresh = useCallback(async () => {
    const res = await postKit<{ groups?: KitGroupBoxes[] }>({ action: "groups", eventId });
    if (res.ok && res.groups) setGroups(res.groups);
  }, [eventId]);

  useEffect(() => {
    // Initial load of the group list; setState happens after the awaited fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function stage(code: string) {
    setBusy(true);
    const res = await postKit<{ group?: string; boxNo?: number; staged?: number; total?: number }>({
      action: "stage",
      boxCode: code,
    });
    setBusy(false);
    if (!res.ok) return setBanner({ ok: false, text: res.message ?? "Could not stage" });
    setBanner({
      ok: true,
      text: `${res.group} box ${res.boxNo} staged: ${res.staged} of ${res.total}`,
    });
    void refresh();
  }

  const selected = groups.find((g) => g.group === group);
  const expected = selected?.boxes.map((b) => b.code) ?? [];
  const notStaged = selected?.boxes.filter((b) => b.status !== "staged") ?? [];
  const allScanned = expected.length > 0 && expected.every((c) => scanned.includes(c));

  function scanOut(raw: string) {
    const code = raw.trim().toUpperCase();
    if (!selected) return setBanner({ ok: false, text: "Pick the group first" });
    if (!expected.includes(code)) return setBanner({ ok: false, text: `${code} is not a box of ${selected.group}` });
    if (scanned.includes(code)) return setBanner({ ok: false, text: `${code} already scanned` });
    const next = [...scanned, code];
    setScanned(next);
    setBanner({ ok: true, text: `${next.length} of ${expected.length} boxes scanned out` });
  }

  async function signOff() {
    setBusy(true);
    const res = await postKit({
      action: "handover",
      eventId,
      group,
      receiverName: name,
      receiverMobile: mobile,
      boxCodes: scanned,
    });
    setBusy(false);
    if (!res.ok) return setBanner({ ok: false, text: res.message ?? "Handover failed" });
    setBanner({ ok: true, text: `Handed over ${scanned.length} boxes of ${group} to ${name}` });
    setScanned([]);
    setName("");
    setMobile("");
    setGroup("");
    void refresh();
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-white/10 p-1 text-sm">
        {(["stage", "handover"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setBanner(null);
            }}
            className={`rounded-md px-4 py-2 font-semibold ${
              mode === m ? "bg-emerald-500 text-neutral-950" : "text-neutral-300 hover:bg-white/10"
            }`}
          >
            {m === "stage" ? "Stage ready boxes" : "Day-0 handover"}
          </button>
        ))}
      </div>

      <ResultBanner banner={banner} />

      {mode === "stage" ? (
        <>
          <ScanInput label="Scan each ready group-box label" onScan={stage} disabled={busy} />
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-left text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 font-medium">Boxes</th>
                  <th className="px-4 py-3 font-medium">Staged</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.group} className="border-t border-white/10">
                    <td className="px-4 py-3">{g.group}</td>
                    <td className="px-4 py-3">{g.boxes.length}</td>
                    <td className="px-4 py-3">
                      {g.boxes.filter((b) => b.status === "staged" || b.status === "handed_over").length}
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-neutral-500">
                      No group boxes yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400">Company / group collecting</label>
            <select
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setScanned([]);
                setBanner(null);
              }}
              className={inputClass}
            >
              <option value="" className="bg-neutral-900">
                Choose a group
              </option>
              {groups.map((g) => {
                const done = g.boxes.every((b) => b.status === "handed_over");
                return (
                  <option key={g.group} value={g.group} disabled={done} className="bg-neutral-900">
                    {g.group} ({g.boxes.length} boxes{done ? ", handed over" : ""})
                  </option>
                );
              })}
            </select>
          </div>

          {selected && notStaged.length > 0 && (
            <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              {notStaged.length} box(es) not staged yet: {notStaged.map((b) => `#${b.boxNo} (${b.status})`).join(", ")}.
              Finish and stage them before handover.
            </p>
          )}

          {selected && notStaged.length === 0 && (
            <>
              <ScanInput label="Scan every box out" onScan={scanOut} disabled={busy} />
              <p className="text-2xl font-bold">
                {scanned.length} of {expected.length}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-neutral-400">Receiver name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400">Receiver mobile (10 digits)</label>
                  <input
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    inputMode="numeric"
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                disabled={busy || !allScanned || name.trim().length < 2 || mobile.length !== 10}
                onClick={signOff}
                className="w-full rounded-lg bg-emerald-500 px-4 py-4 text-lg font-bold text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sign off handover
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
