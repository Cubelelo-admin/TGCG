"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, FilterChip, IdLink, Pagination, StatusPill, type ColumnDef, type StatusTone } from "@/components/ds";

export type PaymentKindFilter = "all" | "manual" | "bulk_import" | "category_change";

/** One direct payment, formatted on the server (dates in IST, ₹ text). */
export interface PaymentRowView {
  key: string;
  kind: "manual" | "bulk_import" | "category_change";
  date: string;
  time: string;
  registrationCode: string | null;
  fullName: string;
  category: string;
  /** "10 KM → 21 KM" for a category change. */
  categoryChange: string | null;
  mode: string | null;
  reference: string | null;
  note: string | null;
  poc: string | null;
  recordedBy: string | null;
  amountText: string;
  refund: boolean;
}

const KIND: Record<PaymentRowView["kind"], { label: string; tone: StatusTone }> = {
  manual: { label: "Manual override", tone: "warning" },
  bulk_import: { label: "Bulk import", tone: "info" },
  category_change: { label: "Category change", tone: "pending" },
};

const FILTERS: { value: PaymentKindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual override" },
  { value: "bulk_import", label: "Bulk import" },
  { value: "category_change", label: "Category changes" },
];

const LINK = "text-12 text-link underline decoration-dashed decoration-1 underline-offset-4 hover:text-[#175CD3]";

/** The individual direct payments, newest first; the server sends one page at a time. */
export function PaymentsTable({
  rows,
  page,
  pageSize,
  totalItems,
  filter,
  counts,
}: {
  rows: PaymentRowView[];
  page: number;
  pageSize: number;
  totalItems: number;
  filter: PaymentKindFilter;
  counts: Record<PaymentKindFilter, number>;
}) {
  const router = useRouter();

  function go(next: { filter?: PaymentKindFilter; page?: number }) {
    const f = next.filter ?? filter;
    const p = next.page ?? 1;
    const params = new URLSearchParams();
    if (f !== "all") params.set("type", f);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    // Stay where the reader is: the table is at the bottom of a long page.
    router.push(`/admin/collections${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  const columns: ColumnDef<PaymentRowView>[] = [
    {
      key: "date",
      header: "Date",
      render: (r) => (
        <span className="whitespace-nowrap">
          {r.date}
          <span className="block text-10 text-ink-muted">{r.time}</span>
        </span>
      ),
    },
    {
      key: "reg",
      header: "Reg. ID",
      render: (r) =>
        r.registrationCode ? (
          <IdLink
            onClick={() =>
              router.push(
                `/admin/registrations?${new URLSearchParams({ q: r.registrationCode!, field: "registration_code" }).toString()}`
              )
            }
          >
            {r.registrationCode}
          </IdLink>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.fullName}</span> },
    {
      key: "category",
      header: "Category",
      render: (r) =>
        r.categoryChange ? (
          <span>
            {r.categoryChange}
            <span className="block text-10 text-ink-muted">now {r.category}</span>
          </span>
        ) : (
          r.category
        ),
    },
    {
      key: "method",
      header: "Method",
      render: (r) => <StatusPill tone={KIND[r.kind].tone}>{KIND[r.kind].label}</StatusPill>,
    },
    {
      key: "mode",
      header: "Mode / ref",
      render: (r) =>
        r.mode || r.reference || r.note ? (
          <span title={r.note ?? undefined} className={r.note ? "cursor-help" : undefined}>
            {r.mode ?? "—"}
            {r.reference && <span className="block break-all font-mono text-10 text-ink-muted">{r.reference}</span>}
          </span>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: "poc",
      header: "POC",
      render: (r) =>
        r.poc ? (
          <Link href={`/admin/registrations?${new URLSearchParams({ q: r.poc, field: "poc" }).toString()}`} className={LINK}>
            {r.poc}
          </Link>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: "by",
      header: "Recorded by",
      render: (r) => (r.recordedBy ? <span className="break-all">{r.recordedBy}</span> : <span className="text-ink-muted">—</span>),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (r) => (
        <span className="whitespace-nowrap font-medium tabular-nums">
          {r.amountText}
          {r.refund && <span className="block text-10 font-normal text-ink-muted">refunded</span>}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Show payments of type">
        {FILTERS.map((f) => (
          <FilterChip key={f.value} active={filter === f.value} count={counts[f.value]} onClick={() => go({ filter: f.value })}>
            {f.label}
          </FilterChip>
        ))}
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        minWidth={1040}
        empty={<p className="py-10 text-center text-14 text-ink-muted">No payments of this type.</p>}
      />
      {totalItems > pageSize && (
        <div className="min-w-0 overflow-x-auto">
          <div className="min-w-[560px]">
            <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={(p) => go({ page: p })} />
          </div>
        </div>
      )}
    </div>
  );
}
