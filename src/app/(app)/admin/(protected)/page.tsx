import { requireAdmin } from "@/lib/admin-auth";
import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminEvent } from "@/lib/admin-event";
import { getDashboardStats } from "@/lib/admin-data";
import { Card, EmptyState, Icon, KpiCard, KpiRow, PageHeader } from "@/components/ds";
import { CategoryPanel, PocPanel } from "./dashboard-panels";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const { event } = await getAdminEvent();
  if (!event) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <Card>
          <EmptyState title="No active event found." />
        </Card>
      </div>
    );
  }

  const stats = await getDashboardStats(event.id);
  const { totals } = stats;

  return (
    <div>
      <PageHeader title={event.name} subtitle="Registrations, collections and kit sizes for this event" />

      <KpiRow>
        <KpiSlot>
          <KpiCard
            tone="green"
            label="Paid Registrations"
            value={totals.paidCount.toLocaleString("en-IN")}
            caption={`${totals.razorpay.count.toLocaleString("en-IN")} Razorpay · ${totals.direct.count.toLocaleString("en-IN")} direct`}
          />
        </KpiSlot>
        <KpiSlot>
          <KpiCard
            tone="green"
            label="Total Revenue"
            value={`₹${totals.revenue.toLocaleString("en-IN")}`}
            caption="Razorpay + collected directly"
          />
        </KpiSlot>
        <KpiSlot>
          <KpiCard
            tone="green"
            label="Via Razorpay"
            value={`₹${totals.razorpay.amount.toLocaleString("en-IN")}`}
            caption={`${totals.razorpay.count.toLocaleString("en-IN")} paid`}
          />
        </KpiSlot>
        <Link
          href="/admin/collections"
          title="See the breakup of money collected directly"
          className="group flex min-w-[220px] flex-1 rounded-16 transition-shadow hover:shadow-dock-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <KpiCard
            tone="orange"
            label={
              <span className="flex w-full items-center justify-between gap-2">
                Collected directly (not Razorpay)
                <Icon name="chevronRight" size={16} className="shrink-0 text-ink-muted group-hover:text-ink" />
              </span>
            }
            value={`₹${totals.direct.amount.toLocaleString("en-IN")}`}
            caption={`${totals.direct.count.toLocaleString("en-IN")} paid · see breakup`}
          />
        </Link>
      </KpiRow>

      <div className="flex flex-col gap-4">
        <TshirtSummary counts={stats.tshirtCounts} />

        {/* Side by side from lg up (grid rows stretch, so both cards match height); stacked below.
            With no POC rows the Category card is the only item and takes the full width. */}
        <div className={`grid grid-cols-1 gap-4 ${stats.pocTotals.length > 0 ? "lg:grid-cols-2" : ""}`}>
          <CategoryPanel rows={stats.categories} />
          {stats.pocTotals.length > 0 && <PocPanel rows={stats.pocTotals} />}
        </div>
      </div>
    </div>
  );
}

/** Lets a KpiCard wrap onto its own line on narrow screens instead of squeezing. */
function KpiSlot({ children }: { children: ReactNode }) {
  return <div className="flex min-w-[220px] flex-1">{children}</div>;
}

function TshirtSummary({ counts }: { counts: { size: string; count: number }[] }) {
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  return (
    <Card
      title="T-Shirt Sizes"
      actions={
        <p className="text-14 text-ink-tertiary">
          {total.toLocaleString("en-IN")} T-shirts · paid registrations only (Child Runner excluded)
        </p>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {counts.map((c) => (
          <div key={c.size} className="rounded-12 border border-line-secondary bg-surface-secondary px-4 py-3">
            <p className="text-12 font-medium uppercase tracking-wide text-ink-tertiary">{c.size}</p>
            <p className="mt-1 text-24 font-semibold tabular-nums text-ink">{c.count.toLocaleString("en-IN")}</p>
            <p className="text-12 text-ink-muted">{total > 0 ? `${Math.round((c.count / total) * 100)}%` : "—"}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
