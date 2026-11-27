"use client";

import { DataTable, EmptyState, StatusPill, type ColumnDef } from "@/components/ds";

/** One kit_log row, with the IST time already formatted on the server. */
export type ExceptionLogRow = {
  id: number;
  when: string;
  ok: boolean;
  what: string;
  actor: string | null;
};

const COLUMNS: ColumnDef<ExceptionLogRow>[] = [
  {
    key: "when",
    header: "When (IST)",
    width: 130,
    render: (e) => <span className="whitespace-nowrap font-mono text-ink-muted">{e.when}</span>,
  },
  {
    key: "status",
    header: "Status",
    width: 130,
    render: (e) =>
      e.ok ? <StatusPill tone="info">Exception</StatusPill> : <StatusPill tone="expired">Rejected scan</StatusPill>,
  },
  {
    key: "what",
    header: "What",
    render: (e) => <span className={e.ok ? "text-ink" : "text-[#D92D20]"}>{e.what}</span>,
  },
  {
    key: "by",
    header: "By",
    width: 180,
    render: (e) => <span className="text-ink-tertiary">{e.actor ?? "-"}</span>,
  },
];

export default function ExceptionLog({ rows }: { rows: ExceptionLogRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(e) => String(e.id)}
      minWidth={560}
      empty={<EmptyState title="Nothing yet" />}
    />
  );
}
