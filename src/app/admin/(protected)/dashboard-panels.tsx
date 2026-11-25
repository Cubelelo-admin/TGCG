"use client";

import { useState } from "react";
import { BarChart, Card, CHART_COLORS, DonutChart, InfoHint, ViewToggle, type BarDatum, type ChartTableView } from "@/components/ds";
import {
  CategoryTable,
  PocTable,
  formatInrSigned,
  pocRegistrationsHref,
  type CategoryRow,
  type PocRow,
} from "./dashboard-tables";

const inr = (n: number) => n.toLocaleString("en-IN");

/**
 * By Category card with a Bar | Pie | Table toggle. Both side-by-side cards open as the bar chart
 * so the shared toggle reads the same on first load. Pie shows each category's share of tickets.
 */
export function CategoryPanel({ rows, className = "" }: { rows: CategoryRow[]; className?: string }) {
  const [view, setView] = useState<ChartTableView>("chart");
  const data: BarDatum[] = rows.map((c) => ({ label: c.name, value: c.sold_count ?? 0 }));
  return (
    <Card
      title="By Category"
      className={`min-w-0 ${className}`}
      actions={<ViewToggle value={view} onChange={setView} ariaLabel="By category view" views={["chart", "pie", "table"]} />}
    >
      {view === "chart" ? (
        <BarChart data={data} ariaLabel="Tickets sold per category" emptyLabel="No categories" />
      ) : view === "pie" ? (
        <DonutChart data={data} totalLabel="tickets" ariaLabel="Share of tickets by category" emptyLabel="No categories" />
      ) : (
        <CategoryTable rows={rows} />
      )}
    </Card>
  );
}

/**
 * By Group POC card with a Chart | Table toggle (defaults to Chart, like By Category).
 * The chart sorts by amount (largest first); each bar links to that POC's registrations, like the table.
 * Bars are orange because this money is part of the orange "Collected directly" total.
 * A POC's net can be negative (category-change refunds): the bar is then empty, so the row says so.
 */
export function PocPanel({ rows, className = "" }: { rows: PocRow[]; className?: string }) {
  const [view, setView] = useState<ChartTableView>("chart");
  const data: BarDatum[] = [...rows]
    .sort((a, b) => b.amount - a.amount)
    .map((p) => {
      const regs = `${inr(p.count)} ${p.count === 1 ? "registration" : "registrations"}`;
      return {
        label: p.pocName,
        value: p.amount,
        display: formatInrSigned(p.amount),
        caption: p.amount < 0 ? `${regs} · net refund` : regs,
        href: pocRegistrationsHref(p.pocName),
      };
    });
  return (
    <Card
      title={
        <span className="flex items-center gap-1">
          By Group POC
          <InfoHint text="Bulk-imported registrations and category-change differences, grouped by the POC responsible for collecting the money." />
        </span>
      }
      className={`min-w-0 ${className}`}
      actions={<ViewToggle value={view} onChange={setView} ariaLabel="By group POC view" />}
    >
      {view === "chart" ? (
        <BarChart data={data} color={CHART_COLORS.orange} ariaLabel="Amount per group POC" emptyLabel="No POC totals" />
      ) : (
        <PocTable rows={rows} />
      )}
    </Card>
  );
}
