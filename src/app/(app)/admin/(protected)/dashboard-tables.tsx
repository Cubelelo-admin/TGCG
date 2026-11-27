"use client";

import Link from "next/link";
import { DataTable, type ColumnDef } from "@/components/ds";

export type PocRow = { pocName: string; count: number; amount: number };
export type CategoryRow = { id: string | number; name: string; sold_count: number | null };

/** Registrations list filtered to one POC (shared by the POC table and the POC bar chart). */
export function pocRegistrationsHref(pocName: string): string {
  return `/admin/registrations?${new URLSearchParams({ q: pocName, field: "poc" }).toString()}`;
}

/** ₹ amount with the sign first, so a net refund reads "-₹500" rather than "₹-500". */
export function formatInrSigned(n: number): string {
  return n < 0 ? `-₹${(-n).toLocaleString("en-IN")}` : `₹${n.toLocaleString("en-IN")}`;
}

const pocColumns: ColumnDef<PocRow>[] = [
  {
    key: "poc",
    header: "POC",
    render: (p) => (
      <Link
        href={pocRegistrationsHref(p.pocName)}
        className="text-14 text-link underline decoration-dashed decoration-1 underline-offset-4 hover:text-[#175CD3]"
      >
        {p.pocName}
      </Link>
    ),
  },
  {
    key: "count",
    header: "Registrations",
    align: "right",
    render: (p) => <span className="tabular-nums">{p.count.toLocaleString("en-IN")}</span>,
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    render: (p) => <span className="tabular-nums">{formatInrSigned(p.amount)}</span>,
  },
];

/** Paid bulk-import / category-change totals per group POC; each name links to the filtered registrations list. */
export function PocTable({ rows }: { rows: PocRow[] }) {
  return <DataTable columns={pocColumns} rows={rows} rowKey={(p) => p.pocName} minWidth={0} />;
}

const categoryColumns: ColumnDef<CategoryRow>[] = [
  { key: "name", header: "Category", render: (c) => c.name },
  {
    key: "sold",
    header: "Sold",
    align: "right",
    render: (c) => <span className="tabular-nums">{(c.sold_count ?? 0).toLocaleString("en-IN")}</span>,
  },
];

export function CategoryTable({ rows }: { rows: CategoryRow[] }) {
  return <DataTable columns={categoryColumns} rows={rows} rowKey={(c) => String(c.id)} minWidth={0} />;
}
