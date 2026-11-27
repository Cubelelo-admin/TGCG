"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BarChart, Card, DataTable, ViewToggle, type ChartTableView, type ColumnDef } from "@/components/ds";
import type { Breakdown, BreakdownRow } from "./breakdowns";
import { TABLE_LINK } from "./PaymentsTable";

type TableRow = BreakdownRow & { isTotal?: boolean };

const EMPTY_LABEL = "No direct payments yet";

/**
 * One breakdown of the direct collections as a Dock Card with a Chart | Table toggle.
 * Everything arrives pre-formatted (strings), so the server page can render it.
 * The bucket total is the first column after the label, so it stays visible when the
 * card is half-width and the per-kind columns scroll.
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
  const grandTotal = totalCells[0];

  const tableColumns: ColumnDef<TableRow>[] = columns.map((col, i) => ({
    key: `c${i}`,
    header: col.header,
    align: col.align,
    render: (r) => {
      if (i === 0) {
        if (r.isTotal) return <span className="font-semibold">Total</span>;
        return r.href ? (
          <Link href={r.href} className={TABLE_LINK}>
            {r.label}
          </Link>
        ) : (
          <span>{r.label}</span>
        );
      }
      const text = r.cells[i - 1];
      const isBucketTotal = i === 1;
      return (
        <span
          className={`whitespace-nowrap tabular-nums ${r.isTotal || isBucketTotal ? "font-semibold" : ""} ${
            text === "₹0" && !r.isTotal ? "text-ink-muted" : ""
          }`}
        >
          {text}
        </span>
      );
    },
  }));

  const tableRows: TableRow[] = [
    ...rows,
    { key: "__total", label: "Total", cells: totalCells, amount: 0, amountText: grandTotal, isTotal: true },
  ];

  return (
    <Card
      title={title}
      className="flex min-w-0 flex-col"
      actions={<ViewToggle value={view} onChange={setView} ariaLabel={`${title} view`} />}
    >
      {description && <p className="-mt-2 mb-4 text-12 text-ink-tertiary">{description}</p>}
      {view === "chart" ? (
        <BarChart
          ariaLabel={title}
          color={color}
          emptyLabel={EMPTY_LABEL}
          data={rows.map((r) => ({ label: r.label, value: r.amount, display: r.amountText, caption: r.caption, href: r.href }))}
        />
      ) : (
        <DataTable
          columns={tableColumns}
          rows={rows.length ? tableRows : []}
          rowKey={(r) => r.key}
          minWidth={0}
          empty={<p className="py-6 text-center text-12 text-ink-muted">{EMPTY_LABEL}</p>}
        />
      )}
      {/* Pinned to the bottom so paired cards' Total rules and footnotes line up. */}
      {((view === "chart" && rows.length > 0) || footnote) && (
        <div className="mt-auto">
          {view === "chart" && rows.length > 0 && (
            <p className="mt-3 flex justify-between border-t border-line-secondary pt-2 text-12 text-ink">
              <span className="font-medium">Total</span>
              <span className="font-semibold tabular-nums">{grandTotal}</span>
            </p>
          )}
          {footnote && <div className="mt-3 text-12 text-ink-tertiary">{footnote}</div>}
        </div>
      )}
    </Card>
  );
}
