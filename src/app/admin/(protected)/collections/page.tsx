import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminEvent } from "@/lib/admin-event";
import { getDirectCollections, getPaymentTotals, getPocTotals, type DirectPayment } from "@/lib/admin-data";
import { MANUAL_PAYMENT_MODE_LABELS, type ManualPaymentMode } from "@/lib/manual-payment";
import { Banner, buttonClass, Card, CHART_COLORS, EmptyState, Icon, KpiCard, KpiRow, PageHeader } from "@/components/ds";
import { BreakdownCard } from "./BreakdownCard";
import { byCategory, byMode, byPoc, byRecorder, inr, summarise, toPaise } from "./breakdowns";
import { PaymentsTable, type PaymentKindFilter, type PaymentRowView } from "./PaymentsTable";

const PAGE_SIZE = 25;
const KIND_FILTERS: PaymentKindFilter[] = ["all", "manual", "bulk_import", "category_change"];
const DIRECT_PAID_HREF = { pathname: "/admin/registrations", query: { method: "direct", status: "paid" } };

const IST_DATE = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const IST_TIME = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const n = (x: number) => x.toLocaleString("en-IN");
const plural = (x: number, word: string) => `${n(x)} ${word}${x === 1 ? "" : "s"}`;

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const { page: rawPage, type: rawType } = await searchParams;
  const { event } = await getAdminEvent();
  if (!event) {
    return (
      <div>
        <Crumbs />
        <PageHeader title="Collected directly (not Razorpay)" />
        <Card>
          <EmptyState title="No active event found." />
        </Card>
      </div>
    );
  }

  const [totals, collections, pocTotals] = await Promise.all([
    getPaymentTotals(event.id),
    getDirectCollections(event.id),
    getPocTotals(event.id),
  ]);
  const { payments } = collections;

  // Reconciliation: the row-level list must add up to the payment_totals RPC, per method.
  const sum = summarise(payments);
  const reconciles =
    sum.total === toPaise(totals.direct.amount) &&
    sum.manual === toPaise(totals.manual.amount) &&
    sum.manualN === totals.manual.count &&
    sum.bulk === toPaise(totals.bulkImport.amount) &&
    sum.bulkN === totals.bulkImport.count &&
    sum.adjustment === toPaise(totals.categoryAdjustments.amount) &&
    sum.adjustmentN === totals.categoryAdjustments.count;

  const modes = byMode(payments);
  const recorders = byRecorder(payments);
  const pocs = byPoc(collections, pocTotals);
  const categories = byCategory(payments);

  // Individual payments: filter + page on the server, send one page to the client.
  const filter: PaymentKindFilter = KIND_FILTERS.includes(rawType as PaymentKindFilter) ? (rawType as PaymentKindFilter) : "all";
  const filtered = filter === "all" ? payments : payments.filter((p) => p.kind === filter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(Number(rawPage)) || 1), pageCount);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toRowView);
  const counts: Record<PaymentKindFilter, number> = {
    all: payments.length,
    manual: sum.manualN,
    bulk_import: sum.bulkN,
    category_change: sum.adjustmentN,
  };

  const taggedTotal = pocs.razorpayTagged.reduce((s, t) => s + toPaise(t.amount), 0) / 100;
  const taggedCount = pocs.razorpayTagged.reduce((s, t) => s + t.count, 0);
  const hasNoPoc = pocs.rows.some((r) => r.key === "none");

  return (
    <div>
      <Crumbs />
      <PageHeader
        title="Collected directly (not Razorpay)"
        subtitle={`${event.name} · money taken outside Razorpay: manual overrides, bulk imports and category-change differences`}
        actions={
          <Link href={DIRECT_PAID_HREF} className={buttonClass()}>
            <Icon name="registrations" size={16} />
            View all in Registrations
          </Link>
        }
      />

      {collections.error && (
        <div className="mb-4">
          <Banner tone="danger" title="Some payments could not be loaded">
            The breakdowns below may be incomplete. Refresh the page; if this keeps happening, check the server logs
            (getDirectCollections).
          </Banner>
        </div>
      )}
      {!collections.error && !reconciles && (
        <div className="mb-4">
          <Banner tone="danger" title="Breakdown doesn't match the total">
            The payments listed add up to {inr(sum.total / 100)} ({plural(payments.length, "payment")}), but the
            collected-directly total is {inr(totals.direct.amount)}. A payment was probably recorded while this page was
            loading. Refresh to load both again.
          </Banner>
        </div>
      )}

      <KpiRow>
        <KpiSlot>
          <KpiCard
            tone="green"
            label="Total collected directly"
            value={inr(totals.direct.amount)}
            caption={`${plural(totals.direct.count, "paid registration")}${
              totals.categoryAdjustments.count > 0 ? ` · ${plural(totals.categoryAdjustments.count, "category change")}` : ""
            }`}
          />
        </KpiSlot>
        <KpiSlot>
          <KpiCard
            tone="orange"
            label="Manual override"
            hint="Pending or failed registrations an admin marked paid after collecting the money directly (UPI, cash, bank transfer)."
            value={inr(totals.manual.amount)}
            caption={plural(totals.manual.count, "registration")}
          />
        </KpiSlot>
        <KpiSlot>
          <KpiCard
            tone="blue"
            label="Bulk import"
            hint="Offline / paper registrations uploaded in bulk; the money is collected by each group's POC."
            value={inr(totals.bulkImport.amount)}
            caption={plural(totals.bulkImport.count, "registration")}
          />
        </KpiSlot>
        <KpiSlot>
          <KpiCard
            tone="grey"
            label="Category changes"
            hint="Price differences settled offline when a paid runner moved category (refunds count as negative)."
            value={inr(totals.categoryAdjustments.amount)}
            caption={
              totals.categoryAdjustments.count > 0
                ? `${plural(totals.categoryAdjustments.count, "change")} · ${inr(sum.collected / 100)} collected · ${inr(
                    sum.refunded / 100
                  )} refunded`
                : "No category changes with money moved"
            }
          />
        </KpiSlot>
      </KpiRow>

      <p className="mb-4 text-12 text-ink-tertiary">
        Total = manual override + bulk import + category changes. Each breakdown below splits that same total, so every
        card&apos;s Total row equals {inr(totals.direct.amount)}.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="By payment mode"
          description="How the money came in. Manual overrides and category changes record a mode; bulk imports don't."
          breakdown={modes}
          color={CHART_COLORS.green}
        />
        <BreakdownCard
          title="By who recorded it"
          description="The admin who marked a payment paid or recorded a category change. Bulk uploads don't store the uploader."
          breakdown={recorders}
          color={CHART_COLORS.blue}
        />
        <BreakdownCard
          title="By POC"
          description="The group POC responsible for collecting the money: bulk imports, manual overrides that name a POC, and category-change differences."
          breakdown={pocs}
          color={CHART_COLORS.orange}
          footnote={
            <PocFootnote
              taggedCount={taggedCount}
              taggedTotal={taggedTotal}
              tagged={pocs.razorpayTagged}
              hasNoPoc={hasNoPoc}
              mismatches={pocs.mismatches}
            />
          }
        />
        <BreakdownCard
          title="By category"
          description="By each runner's current category. A category-change difference counts under the category the runner moved to."
          breakdown={categories}
          color={CHART_COLORS.blue}
        />
      </div>

      <Card
        title="Payments"
        actions={
          <>
            <span className="text-12 text-ink-tertiary">{plural(payments.length, "payment")} · newest first</span>
            <Link href={DIRECT_PAID_HREF} className={buttonClass({ size: "sm" })}>
              View all in Registrations
              <Icon name="arrowRight" size={14} />
            </Link>
          </>
        }
      >
        <PaymentsTable
          rows={pageRows}
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={filtered.length}
          filter={filter}
          counts={counts}
        />
        <p className="mt-2 text-12 text-ink-tertiary">
          Registrations lists each directly-paid registration once. Category changes appear there as an adjustment on the
          runner&apos;s row, including runners who first paid through Razorpay.
        </p>
      </Card>
    </div>
  );
}

/** Dock Breadcrumb markup with a real link (the DS Breadcrumb only takes onClick). */
function Crumbs() {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-12">
      <Link href="/admin" className="text-ink-muted underline decoration-dashed underline-offset-2 hover:text-ink">
        Dashboard
      </Link>
      <Icon name="chevronRight" size={12} className="text-ink-muted" />
      <span aria-current="page" className="font-medium text-ink">
        Collected directly
      </span>
    </nav>
  );
}

/** Lets a KpiCard wrap onto its own line on narrow screens instead of squeezing. */
function KpiSlot({ children }: { children: ReactNode }) {
  return <div className="flex min-w-[220px] flex-1">{children}</div>;
}

function PocFootnote({
  taggedCount,
  taggedTotal,
  tagged,
  hasNoPoc,
  mismatches,
}: {
  taggedCount: number;
  taggedTotal: number;
  tagged: { pocName: string; count: number; amount: number }[];
  hasNoPoc: boolean;
  mismatches: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      {taggedCount === 0 ? (
        mismatches.length === 0 && <p>Each POC&apos;s registrations and amount match the dashboard&apos;s By Group POC table.</p>
      ) : (
        <p>
          The dashboard&apos;s By Group POC table also counts {plural(taggedCount, "registration")} paid through Razorpay
          that are tagged with a POC ({inr(taggedTotal)}). That money wasn&apos;t collected directly, so it isn&apos;t
          included here:{" "}
          {tagged.map((t) => `${t.pocName || "(blank POC)"} ${plural(t.count, "reg")} · ${inr(t.amount)}`).join("; ")}.
        </p>
      )}
      {hasNoPoc && <p>&ldquo;No POC recorded&rdquo; is direct money with no POC on it, mostly manual overrides.</p>}
      {mismatches.length > 0 && (
        <p className="text-on-tint-red">
          Doesn&apos;t match the dashboard for: {mismatches.map((m) => m || "(blank POC)").join(", ")}. Refresh the page; data
          may have changed while it loaded.
        </p>
      )}
    </div>
  );
}

function modeText(p: DirectPayment) {
  if (p.kind === "bulk_import") return null;
  return p.mode ? (MANUAL_PAYMENT_MODE_LABELS[p.mode as ManualPaymentMode] ?? p.mode) : null;
}

function toRowView(p: DirectPayment): PaymentRowView {
  const at = new Date(p.at);
  return {
    key: p.key,
    kind: p.kind,
    date: IST_DATE.format(at),
    time: IST_TIME.format(at),
    registrationCode: p.registrationCode,
    fullName: p.fullName,
    category: p.category ?? "—",
    categoryChange: p.kind === "category_change" ? `${p.fromCategory ?? "?"} → ${p.toCategory ?? "?"}` : null,
    mode: modeText(p),
    reference: p.reference,
    note: p.note,
    poc: p.pocName,
    recordedBy: p.recordedBy,
    amountText: inr(p.amount),
    refund: p.amount < 0,
  };
}
