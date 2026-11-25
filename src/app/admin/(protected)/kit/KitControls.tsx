"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DataTable, EmptyState, Icon, StatusPill, type ColumnDef } from "@/components/ds";
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
      <Button variant="dark" onClick={run} disabled={busy}>
        <Icon name="box" size={16} />
        {busy ? "Generating..." : "Generate boxes"}
      </Button>
      {msg && <p className="mt-2 max-w-[320px] text-14 text-ink-secondary">{msg}</p>}
    </div>
  );
}

/** Deletes boxes nobody has started packing (event-wide, or one POC group) so channels can be changed. */
export function ResetBoxesButton({
  eventId,
  pocName,
  label = "Reset unscanned boxes",
}: {
  eventId: string;
  pocName?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    const scope = pocName ? `for ${pocName}` : "for the whole event";
    if (
      !confirm(
        `Delete every box ${scope} that has nothing scanned into it?\n\nBoxes with any scanned item, and boxes already ready, staged, handed over or collected, are kept. You can then change channels and generate again.`
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    const res = await postKit<{ deleted?: number; kept?: number }>({ action: "reset", eventId, pocName });
    setBusy(false);
    setMsg(
      res.ok
        ? `Removed ${res.deleted} unscanned boxes${res.kept ? `, kept ${res.kept} in progress` : ""}`
        : (res.message ?? "Failed")
    );
    router.refresh();
  }

  return (
    <div>
      <Button size={pocName ? "sm" : "md"} onClick={run} disabled={busy}>
        <Icon name="undo" size={pocName ? 14 : 16} />
        {busy ? "Resetting..." : label}
      </Button>
      {msg && (
        <p
          className={
            pocName
              ? "mt-1 w-fit rounded-4 bg-tint-orange px-1.5 py-1 text-12 font-medium text-on-tint-orange"
              : "mt-2 max-w-[320px] text-14 text-ink-secondary"
          }
        >
          {msg}
        </p>
      )}
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
      <StatusPill tone={isCorporate ? "info" : "pending"}>
        {isCorporate ? `Corporate (${corporate}/${total})` : "Expo"}
      </StatusPill>
      <Button size="sm" onClick={toggle} disabled={busy}>
        <Icon name="swap" size={14} />
        {isCorporate ? "Move to expo" : "Make corporate (day 0)"}
      </Button>
      {msg && (
        <span className="rounded-4 bg-tint-orange px-1.5 py-1 text-12 font-medium text-on-tint-orange">{msg}</span>
      )}
    </div>
  );
}

type PocRow = { poc_name: string; paid_count: number; corporate_count: number; boxed_count: number };

/** POC summary table: paid / boxed counts with the channel toggle and per-group reset. */
export function PocTable({ eventId, pocs }: { eventId: string; pocs: PocRow[] }) {
  const columns: ColumnDef<PocRow>[] = [
    {
      key: "poc",
      header: "POC / group",
      render: (p) => <span className="font-medium">{p.poc_name}</span>,
    },
    {
      key: "paid",
      header: "Paid",
      align: "right",
      width: 90,
      render: (p) => <span className="tabular-nums">{Number(p.paid_count)}</span>,
    },
    {
      key: "boxed",
      header: "Boxed",
      align: "right",
      width: 90,
      render: (p) => <span className="tabular-nums">{Number(p.boxed_count)}</span>,
    },
    {
      key: "channel",
      header: "Channel",
      render: (p) => (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ChannelToggle
            eventId={eventId}
            pocName={p.poc_name}
            corporate={Number(p.corporate_count)}
            total={Number(p.paid_count)}
          />
          {Number(p.boxed_count) > 0 && <ResetBoxesButton eventId={eventId} pocName={p.poc_name} label="Reset boxes" />}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={pocs}
      rowKey={(p) => p.poc_name}
      minWidth={640}
      empty={<EmptyState title="No POC groups for this event" />}
    />
  );
}
