"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  FieldLabel,
  Icon,
  StatusPill,
  Tabs,
  TextField,
  inputClass,
  type ColumnDef,
} from "@/components/ds";
import ScanInput, { ResultBanner, postKit, type Banner } from "../ScanInput";
import type { KitGroupBoxes } from "@/lib/kit";

const MODE_TABS = [
  { key: "stage", label: "Stage ready boxes" },
  { key: "handover", label: "Day-0 handover" },
];

const stagedCount = (g: KitGroupBoxes) =>
  g.boxes.filter((b) => b.status === "staged" || b.status === "handed_over").length;

const groupColumns: ColumnDef<KitGroupBoxes>[] = [
  { key: "group", header: "Group", render: (g) => <span className="text-14 font-medium">{g.group}</span> },
  { key: "boxes", header: "Boxes", align: "right", width: 80, render: (g) => <span className="text-14">{g.boxes.length}</span> },
  {
    key: "staged",
    header: "Staged",
    align: "right",
    width: 96,
    render: (g) => {
      const n = stagedCount(g);
      return (
        <StatusPill tone={g.boxes.length > 0 && n === g.boxes.length ? "active" : n > 0 ? "warning" : "pending"}>
          {n}
        </StatusPill>
      );
    },
  },
];

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

  const pct = expected.length ? Math.round((scanned.length / expected.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <Tabs
        variant="segmented"
        tabs={MODE_TABS}
        activeKey={mode}
        onChange={(m) => {
          setMode(m as "stage" | "handover");
          setBanner(null);
        }}
      />

      <ResultBanner banner={banner} />

      {mode === "stage" ? (
        <>
          <Card>
            <ScanInput label="Scan each ready group-box label" onScan={stage} disabled={busy} />
          </Card>
          <Card title="Group boxes">
            <DataTable
              columns={groupColumns}
              rows={groups}
              rowKey={(g) => g.group}
              minWidth={0}
              empty={<EmptyState title="No group boxes yet" />}
            />
          </Card>
        </>
      ) : (
        <div className="space-y-4">
          <Card>
            <FieldLabel label="Company / group collecting" htmlFor="handover-group" />
            <select
              id="handover-group"
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setScanned([]);
                setBanner(null);
              }}
              className={`${inputClass} h-12! text-16!`}
            >
              <option value="">Choose a group</option>
              {groups.map((g) => {
                const done = g.boxes.every((b) => b.status === "handed_over");
                return (
                  <option key={g.group} value={g.group} disabled={done}>
                    {g.group} ({g.boxes.length} boxes{done ? ", handed over" : ""})
                  </option>
                );
              })}
            </select>
          </Card>

          {selected && notStaged.length > 0 && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-8 bg-tint-orange px-4 py-3 text-14 font-medium text-on-tint-orange"
            >
              <Icon name="warning" size={20} className="mt-px shrink-0" />
              <p className="min-w-0">
                {notStaged.length} box(es) not staged yet: {notStaged.map((b) => `#${b.boxNo} (${b.status})`).join(", ")}.
                Finish and stage them before handover.
              </p>
            </div>
          )}

          {selected && notStaged.length === 0 && (
            <>
              <Card>
                <ScanInput label="Scan every box out" onScan={scanOut} disabled={busy} />
                <div className="mt-5 flex items-baseline justify-between gap-3">
                  <p className="text-32 font-semibold text-ink">
                    {scanned.length} of {expected.length}
                  </p>
                  {allScanned && <StatusPill tone="active">All boxes scanned</StatusPill>}
                </div>
                <div
                  className="mt-2 h-3 overflow-hidden rounded-full bg-surface-tertiary"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={expected.length}
                  aria-valuenow={scanned.length}
                  aria-label="Boxes scanned out"
                >
                  <div
                    className={`h-full rounded-full transition-all ${allScanned ? "bg-[#079455]" : "bg-dark"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <ul className="mt-4 max-h-56 divide-y divide-line-secondary overflow-y-auto rounded-8 border border-line">
                  {selected.boxes.map((b) => {
                    const isOut = scanned.includes(b.code);
                    return (
                      <li key={b.code} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="min-w-0 text-14 font-medium text-ink">Box #{b.boxNo}</span>
                        <StatusPill tone={isOut ? "active" : "pending"}>{isOut ? "Scanned" : "To scan"}</StatusPill>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card title="Receiver">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="handover-receiver-name"
                    label="Receiver name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <TextField
                    id="handover-receiver-mobile"
                    label="Receiver mobile (10 digits)"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    inputMode="numeric"
                  />
                </div>
              </Card>

              <Button
                variant="dark"
                disabled={busy || !allScanned || name.trim().length < 2 || mobile.length !== 10}
                onClick={signOff}
                className="h-14! w-full text-16!"
              >
                <Icon name="handover" size={20} />
                Sign off handover
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
