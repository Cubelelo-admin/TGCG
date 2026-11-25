import { requireAdmin } from "@/lib/admin-auth";
import Link from "next/link";
import type { ReactNode } from "react";
import { getBulkImportCategories } from "@/lib/catalog";
import { getAdminEvent } from "@/lib/admin-event";
import { getPaymentTotals, listRegistrations, PAYMENT_METHOD_FILTERS, type RegistrationRow } from "@/lib/admin-data";
import { MANUAL_PAYMENT_MODE_LABELS, PAYMENT_METHOD_LABELS, type ManualPaymentMode } from "@/lib/manual-payment";
import { parseSearchField, SEARCH_FIELDS } from "@/lib/registration-search";
import {
  Banner,
  Button,
  buttonClass,
  Card,
  EmptyState,
  Icon,
  inputClass,
  KpiCard,
  KpiRow,
  PageHeader,
  pageItems,
  SearchInput,
  StatusPill,
  type StatusTone,
} from "@/components/ds";
import ResendWaButton from "./ResendWaButton";
import EditRegistrationButton from "./EditRegistrationButton";
import BulkUploadButton from "./BulkUploadButton";
import MarkPaidButton from "./MarkPaidButton";

const STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"] as const;

const METHOD_FILTER_LABELS: Record<(typeof PAYMENT_METHOD_FILTERS)[number], string> = {
  razorpay: "Razorpay",
  direct: "Collected directly (all)",
  manual: "Manual override",
  bulk_import: "Bulk import",
};

/* Dock table classes, matching ds/DataTable (server-rendered here so the rows need no render functions). */
const TH_BASE = "bg-surface-tertiary px-3 py-2.5 text-12 font-normal text-ink-tertiary shadow-[inset_0_-1px_0_#E5E7EB]";
const TH = `${TH_BASE} text-left`;
const TD ="bg-white px-3 py-2.5 align-middle text-ink group-hover:bg-surface-secondary";

/** IdLink look (14px link blue, 1px dashed underline) for identifiers that are real links. */
const ID_LINK = "text-14 text-link underline decoration-dashed decoration-1 underline-offset-4 hover:text-[#175CD3]";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; field?: string; status?: string; method?: string; group?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q, field: rawField, status, method: rawMethod, group: groupId, page } = await searchParams;
  const field = parseSearchField(rawField);
  const method = (PAYMENT_METHOD_FILTERS as readonly string[]).includes(rawMethod ?? "") ? rawMethod : undefined;
  const { event } = await getAdminEvent();
  if (!event) {
    return (
      <div>
        <PageHeader title="Registrations" />
        <Card>
          <EmptyState title="No active event found." />
        </Card>
      </div>
    );
  }

  const pageNum = Number(page) || 1;
  const [{ rows, count, pageSize }, totals, categoryRows] = await Promise.all([
    listRegistrations({
      eventId: event.id,
      search: q,
      searchField: field,
      status,
      method,
      groupId,
      page: pageNum,
    }),
    getPaymentTotals(event.id),
    getBulkImportCategories(event.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const exportHref = `/api/admin/export?${new URLSearchParams({
    ...(q ? { q } : {}),
    ...(q && field !== "all" ? { field } : {}),
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
  }).toString()}`;

  const directSelected = method === "direct" && status === "paid";

  const pageHref = (p: number) => ({
    pathname: "/admin/registrations",
    query: {
      ...(q ? { q } : {}),
      ...(q && field !== "all" ? { field } : {}),
      ...(status ? { status } : {}),
      ...(method ? { method } : {}),
      ...(groupId ? { group: groupId } : {}),
      page: p,
    },
  });

  return (
    <div>
      <PageHeader
        title={`Registrations (${count})`}
        subtitle={`Everyone registered for ${event.name}`}
        actions={
          <>
            <BulkUploadButton eventId={event.id} eventName={event.name} categories={categoryRows} />
            <a href={exportHref} className={buttonClass()}>
              <Icon name="download" size={16} />
              Export CSV
            </a>
          </>
        }
      />

      <KpiRow>
        <KpiSlot>
          <KpiCard
            tone="green"
            label="Total collected"
            value={`₹${totals.revenue.toLocaleString("en-IN")}`}
            caption={`${totals.paidCount.toLocaleString("en-IN")} paid`}
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
          href={
            directSelected
              ? "/admin/registrations"
              : { pathname: "/admin/registrations", query: { method: "direct", status: "paid" } }
          }
          aria-current={directSelected ? "true" : undefined}
          title={
            directSelected
              ? "Filtered to payments collected directly. Click to clear the filter."
              : "Show only payments collected directly"
          }
          className="group flex min-w-[220px] flex-1 rounded-16 transition-shadow hover:shadow-dock-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <KpiCard
            tone="orange"
            selected={directSelected}
            label={
              <span className="flex w-full items-center justify-between gap-2">
                Collected directly (not Razorpay)
                <Icon name="chevronRight" size={16} className="shrink-0 text-ink-muted group-hover:text-ink" />
              </span>
            }
            value={`₹${totals.direct.amount.toLocaleString("en-IN")}`}
            caption={
              <>
                {totals.direct.count.toLocaleString("en-IN")} paid · ₹{totals.manual.amount.toLocaleString("en-IN")} manual override · ₹
                {totals.bulkImport.amount.toLocaleString("en-IN")} bulk import
                {totals.categoryAdjustments.count > 0 &&
                  ` · ₹${totals.categoryAdjustments.amount.toLocaleString("en-IN")} category changes`}
              </>
            }
          />
        </Link>
      </KpiRow>

      {groupId && (
        <div className="mb-4">
          <Banner
            tone="info"
            action={
              <Link href="/admin/registrations" className={buttonClass({ size: "sm" })}>
                <Icon name="close" size={14} />
                Clear
              </Link>
            }
          >
            <span className="text-14">Filtered to one group booking.</span>
          </Banner>
        </div>
      )}

      <form
        method="get"
        className="mb-4 flex flex-wrap items-center gap-2 rounded-8 bg-white px-4 py-3 shadow-card"
      >
        <SearchInput
          name="q"
          defaultValue={q}
          aria-label="Search registrations"
          placeholder="Search any field: name, phone, BIB, reg./group ID, category, POC, city, Aadhar, UTR, DOB…"
          className="w-full min-w-0 sm:w-auto sm:min-w-[280px] sm:flex-1"
        />
        <select name="field" defaultValue={field} aria-label="Search in" className={`${inputClass} sm:w-auto`}>
          {Object.entries(SEARCH_FIELDS).map(([key, label]) => (
            <option key={key} value={key}>
              {key === "all" ? "Search in: all fields" : label}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={`${inputClass} sm:w-auto`}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {capitalize(s)}
            </option>
          ))}
        </select>
        <select name="method" defaultValue={method ?? ""} aria-label="Payment method" className={`${inputClass} sm:w-auto`}>
          <option value="">All payment methods</option>
          {PAYMENT_METHOD_FILTERS.map((m) => (
            <option key={m} value={m}>
              {METHOD_FILTER_LABELS[m]}
            </option>
          ))}
        </select>
        <Button variant="dark" className="w-full sm:w-auto">
          <Icon name="funnel" size={16} />
          Filter
        </Button>
      </form>

      <div className="max-h-[75vh] overflow-auto rounded-8 border border-line">
        <table className="w-full border-collapse text-12" style={{ minWidth: 1100 }}>
          <thead className="sticky top-0 z-[2]">
            <tr>
              <th className={TH}>Reg. ID</th>
              <th className={TH}>Group ID</th>
              <th className={TH}>Name</th>
              <th className={TH}>Category</th>
              <th className={TH}>Contact</th>
              <th className={TH}>BIB</th>
              <th className={TH}>Status</th>
              <th className={`${TH_BASE} text-right`}>Amount</th>
              <th className={TH}>Registered</th>
              <th className={`${TH} w-px`}>
                <span className="sr-only">Payment actions</span>
              </th>
              <th className={`${TH} w-px`}>
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="group border-t border-alpha-4">
                <td className={`${TD} whitespace-nowrap`}>
                  {r.registration_code ? (
                    <span className="select-all font-mono text-12 text-ink">{r.registration_code}</span>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {r.group_id && r.registration_groups?.booking_code ? (
                    <Link href={{ pathname: "/admin/registrations", query: { group: r.group_id } }} className={ID_LINK}>
                      {r.registration_groups.booking_code}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
                <td className={TD}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{r.full_name}</span>
                    {r.poc_name && (
                      <Link
                        href={{ pathname: "/admin/registrations", query: { q: r.poc_name, field: "poc" } }}
                        title="Group POC — collecting the money for this registration. Click to see everyone under this POC."
                        className="whitespace-nowrap rounded-4 bg-tint-orange px-1.5 py-0.5 text-12 font-medium text-on-tint-orange hover:underline"
                      >
                        POC: {r.poc_name}
                      </Link>
                    )}
                    {r.group_id && r.registration_groups && r.registration_groups.attendee_count > 1 && (
                      <Link
                        href={{ pathname: "/admin/registrations", query: { group: r.group_id } }}
                        className="rounded-full bg-line-secondary px-2 py-0.5 text-12 text-ink hover:bg-line"
                      >
                        ×{r.registration_groups.attendee_count}
                      </Link>
                    )}
                  </div>
                </td>
                <td className={TD}>{r.ticket_categories?.name}</td>
                <td className={TD}>
                  <div>{r.email}</div>
                  <div className="text-ink-muted">{r.phone}</div>
                </td>
                <td className={`${TD} whitespace-nowrap`}>{r.bib_number ?? "—"}</td>
                <td className={`${TD} whitespace-nowrap`}>
                  <div className="flex items-center gap-1.5">
                    <PaymentStatusPill status={r.payment_status} />
                    <DirectPaymentFlag row={r} />
                  </div>
                </td>
                <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>
                  ₹{Number(r.amount_inr).toLocaleString("en-IN")}
                  <AdjustmentFlag row={r} />
                </td>
                <td className={`${TD} whitespace-nowrap text-ink-tertiary`}>
                  {new Date(r.created_at).toLocaleDateString("en-IN")}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {r.payment_status === "paid" && <ResendWaButton registrationId={r.id} />}
                  {(r.payment_status === "pending" || r.payment_status === "failed") && (
                    <MarkPaidButton registrationId={r.id} name={r.full_name} />
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  <EditRegistrationButton registration={r} categories={categoryRows} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="bg-white">
                  <EmptyState title="No registrations found." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PageLinks
        page={pageNum}
        totalPages={totalPages}
        firstItem={rows.length ? (pageNum - 1) * pageSize + 1 : 0}
        lastItem={rows.length ? (pageNum - 1) * pageSize + rows.length : 0}
        totalItems={count}
        href={pageHref}
      />
    </div>
  );
}

/** Lets a KpiCard wrap onto its own line on narrow screens instead of squeezing. */
function KpiSlot({ children }: { children: ReactNode }) {
  return <div className="flex min-w-[220px] flex-1">{children}</div>;
}

const STATUS_TONES: Record<string, StatusTone> = {
  paid: "active",
  pending: "pending",
  failed: "expired",
  refunded: "info",
  cancelled: "pending",
};

function PaymentStatusPill({ status }: { status: string }) {
  return <StatusPill tone={STATUS_TONES[status] ?? "pending"}>{capitalize(status)}</StatusPill>;
}

/**
 * Dock pagination (ds/Pagination layout) rendered with links so it stays a server component:
 * item counter on the left, « ‹ pages › » in the centre, grey current page.
 */
function PageLinks({
  page,
  totalPages,
  firstItem,
  lastItem,
  totalItems,
  href,
}: {
  page: number;
  totalPages: number;
  firstItem: number;
  lastItem: number;
  totalItems: number;
  href: (p: number) => { pathname: string; query: Record<string, string | number> };
}) {
  const arrow = "flex h-9 w-9 items-center justify-center rounded-6";
  const nav = (label: string, icon: "chevronsLeft" | "chevronLeft" | "chevronRight" | "chevronsRight", target: number, enabled: boolean) =>
    enabled ? (
      <Link aria-label={label} href={href(target)} className={`${arrow} text-dark hover:bg-surface-secondary`}>
        <Icon name={icon} size={16} />
      </Link>
    ) : (
      <span aria-disabled="true" aria-label={label} className={`${arrow} text-ink-disabled`}>
        <Icon name={icon} size={16} />
      </span>
    );

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
      <span className="text-14 text-ink-muted">
        {firstItem}-{lastItem} of {totalItems} items
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {nav("First page", "chevronsLeft", 1, page > 1)}
        {nav("Previous page", "chevronLeft", page - 1, page > 1)}
        {pageItems(Math.min(Math.max(page, 1), totalPages), totalPages).map((item) =>
          typeof item === "number" ? (
            <Link
              key={item}
              href={href(item)}
              aria-current={item === page ? "page" : undefined}
              className={`flex h-8 min-w-8 items-center justify-center rounded-4 px-1.5 text-14 text-ink ${
                item === page ? "bg-surface-tertiary" : "hover:bg-surface-secondary"
              }`}
            >
              {item}
            </Link>
          ) : (
            <span key={item} className="flex h-8 w-8 items-center justify-center text-14 text-ink">
              …
            </span>
          )
        )}
        {nav("Next page", "chevronRight", page + 1, page < totalPages)}
        {nav("Last page", "chevronsRight", totalPages, page < totalPages)}
      </div>
      <span className="hidden w-[120px] sm:block" aria-hidden="true" />
    </nav>
  );
}

/** Distinct marker for money that never went through Razorpay. */
function DirectPaymentFlag({ row }: { row: RegistrationRow }) {
  if (row.payment_method === "razorpay") return null;

  const mode = row.manual_payment_mode as ManualPaymentMode | null;
  const label = row.payment_method === "manual" ? (mode ? MANUAL_PAYMENT_MODE_LABELS[mode] : "Direct") : "Offline";
  const details = [
    PAYMENT_METHOD_LABELS[row.payment_method] ?? row.payment_method,
    row.manual_payment_ref && `Ref: ${row.manual_payment_ref}`,
    row.manual_paid_by && `By: ${row.manual_paid_by}`,
    row.manual_paid_at && `On: ${new Date(row.manual_paid_at).toLocaleString("en-IN")}`,
    row.manual_payment_note && `Note: ${row.manual_payment_note}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <span title={details} className="cursor-help">
      <StatusPill tone={row.payment_method === "manual" ? "warning" : "info"}>Direct · {label}</StatusPill>
    </span>
  );
}

/** Category changes on this registration, with the offline difference settled. */
function AdjustmentFlag({ row }: { row: RegistrationRow }) {
  if (row.adjustments.length === 0) return null;

  const net = row.adjustments.reduce((sum, a) => sum + a.amount_inr, 0);
  const details = row.adjustments
    .map((a) =>
      [
        `${a.from_category_name ?? "?"} → ${a.to_category_name ?? "?"}`,
        a.amount_inr > 0
          ? `Collected ₹${a.amount_inr.toLocaleString("en-IN")}`
          : a.amount_inr < 0
            ? `Refunded ₹${(-a.amount_inr).toLocaleString("en-IN")}`
            : "No price difference",
        a.mode && (MANUAL_PAYMENT_MODE_LABELS[a.mode as ManualPaymentMode] ?? a.mode),
        a.reference && `Ref: ${a.reference}`,
        a.poc_name && `POC: ${a.poc_name}`,
        a.created_by && `By: ${a.created_by}`,
        `On: ${new Date(a.created_at).toLocaleString("en-IN")}`,
        a.note && `Note: ${a.note}`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");

  return (
    <span title={details} className="ml-1.5 cursor-help">
      <StatusPill tone="pending">
        {net === 0 ? "Cat. changed" : `${net > 0 ? "+" : "−"}₹${Math.abs(net).toLocaleString("en-IN")} adj.`}
      </StatusPill>
    </span>
  );
}
