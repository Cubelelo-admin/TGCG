"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BarChart, Card, DataTable, ViewToggle, type ChartTableView, type ColumnDef } from "@/components/ds";
import type { Breakdown, BreakdownRow } from "./breakdowns";

type TableRow = BreakdownRow & { isTotal?: boolean };

const LINK = "text-12 text-link underline decoration-dashed decoration-1 underline-offset-4 hover:text-[#175CD3]";

/**
 * One breakdown of the direct collections as a Dock Card with a Chart | Table toggle.
 * Everything arrives pre-formatted (strings), so the server page can render it.
 */
export function BreakdownCard({
  title,
  description,
  breakdown,
  color,
  defaultView = "chart",
  footnote,
}: {
  title: string;
  description?: ReactNode;
  breakdown: Breakdown;
  /** Bar colour (a CHART_COLORS value). */
  color?: string;
  defaultView?: ChartTableView;
  footnote?: ReactNode;
}) {
  const [view, setView] = useState<ChartTableView>(defaultView);
  const { columns, rows, totalCells } = breakdown;

  const tableColumns: ColumnDef<TableRow>[] = columns.map((col, i) => ({
    key: `c${i}`,
    header: col.header,
    align: col.align,
    render: (r) => {
      if (i === 0) {
        if (r.isTotal) return <span className="font-semibold">Total</span>;
        return r.href ? (
          <Link href={r.href} className={LINK}>
            {r.label}
          </Link>
        ) : (
          <span>{r.label}</span>
        );
      }
      const text = r.cells[i - 1];
      const last = i === columns.length - 1;
      return (
        <span className={`whitespace-nowrap tabular-nums ${r.isTotal || last ? "font-semibold" : ""} ${text === "₹0" && !r.isTotal ? "text-ink-muted" : ""}`}>
          {text}
        </span>
      );
    },
  }));

  const tableRows: TableRow[] = [
    ...rows,
    { key: "__total", label: "Total", cells: totalCells, amount: 0, amountText: totalCells[totalCells.length - 1], isTotal: true },
  ];

  return (
    <Card
      title={title}
      className="flex min-w-0 flex-col"
      actions={<ViewToggle value={view} onChange={setView} ariaLabel={`${title} view`} />}
    >
      {description && <p className="-mt-2 mb-4 text-12 text-ink-tertiary">{description}</p>}
      {view === "chart" ? (
        <>
          <BarChart
            ariaLabel={title}
            color={color}
            emptyLabel="No direct payments yet"
            data={rows.map((r) => ({ label: r.label, value: r.amount, display: r.amountText, caption: r.caption, href: r.href }))}
          />
          {rows.length > 0 && (
            <p className="mt-3 flex justify-between border-t border-line-secondary pt-2 text-12 text-ink">
              <span className="font-medium">Total</span>
              <span className="font-semibold tabular-nums">{totalCells[totalCells.length - 1]}</span>
            </p>
          )}
        </>
      ) : (
        <DataTable columns={tableColumns} rows={rows.length ? tableRows : []} rowKey={(r) => r.key} minWidth={columns.length > 4 ? 560 : 0} />
      )}
      {footnote && <div className="mt-3 text-12 text-ink-tertiary">{footnote}</div>}
    </Card>
  );
}
