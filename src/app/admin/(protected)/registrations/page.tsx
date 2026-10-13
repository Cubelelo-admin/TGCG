import Link from "next/link";
import { getBulkImportCategories, getEvent } from "@/lib/catalog";
import { getPaymentTotals, listRegistrations, PAYMENT_METHOD_FILTERS, type RegistrationRow } from "@/lib/admin-data";
import { MANUAL_PAYMENT_MODE_LABELS, PAYMENT_METHOD_LABELS, type ManualPaymentMode } from "@/lib/manual-payment";
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

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; method?: string; group?: string; page?: string }>;
}) {
  const { q, status, method: rawMethod, group: groupId, page } = await searchParams;
  const method = (PAYMENT_METHOD_FILTERS as readonly string[]).includes(rawMethod ?? "") ? rawMethod : undefined;
  const event = await getEvent();
  if (!event) return <p className="text-neutral-400">No active event found.</p>;

  const pageNum = Number(page) || 1;
  const [{ rows, count, pageSize }, totals, categoryRows] = await Promise.all([
    listRegistrations({
      eventId: event.id,
      search: q,
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
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
  }).toString()}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold sm:text-2xl">Registrations ({count})</h1>
        <div className="flex flex-wrap gap-3">
          <BulkUploadButton categories={categoryRows} />
          <a
            href={exportHref}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium hover:border-white/40"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Total collected" value={totals.revenue} sub={`${totals.paidCount} paid`} />
        <Metric label="Via Razorpay" value={totals.razorpay.amount} sub={`${totals.razorpay.count} paid`} />
        <Link
          href={{ pathname: "/admin/registrations", query: { method: "direct", status: "paid" } }}
          className="rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-4 py-3 hover:border-sky-400/60"
        >
          <p className="text-xs text-sky-300">Collected directly (not Razorpay) →</p>
          <p className="mt-0.5 text-xl font-bold text-sky-300">₹{totals.direct.amount.toLocaleString("en-IN")}</p>
          <p className="text-xs text-neutral-400">
            {totals.direct.count} paid · ₹{totals.manual.amount.toLocaleString("en-IN")} manual · ₹
            {totals.bulkImport.amount.toLocaleString("en-IN")} bulk import
          </p>
        </Link>
      </div>

      {groupId && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          Filtered to one group booking.
          <Link href="/admin/registrations" className="underline">
            Clear
          </Link>
        </div>
      )}

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone, registration ID"
          className="w-full min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm focus:border-emerald-400 focus:outline-none sm:w-auto"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3.5 py-2 text-sm text-neutral-50 focus:border-emerald-400 focus:outline-none sm:w-auto"
        >
          <option value="" className="bg-neutral-900 text-neutral-50">
            All statuses
          </option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-neutral-900 text-neutral-50 capitalize">
              {s}
            </option>
          ))}
        </select>
        <select
          name="method"
          defaultValue={method ?? ""}
          className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3.5 py-2 text-sm text-neutral-50 focus:border-emerald-400 focus:outline-none sm:w-auto"
        >
          <option value="" className="bg-neutral-900 text-neutral-50">
            All payment methods
          </option>
          {PAYMENT_METHOD_FILTERS.map((m) => (
            <option key={m} value={m} className="bg-neutral-900 text-neutral-50">
              {METHOD_FILTER_LABELS[m]}
            </option>
          ))}
        </select>
        <button className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-medium hover:border-white/40 sm:w-auto">
          Filter
        </button>
      </form>

      <div className="mt-6 -mx-6 max-h-[75vh] overflow-auto px-6 sm:mx-0 sm:rounded-xl sm:border sm:border-white/10 sm:px-0">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-900 text-left text-neutral-400 shadow-[0_1px_0_rgba(255,255,255,0.1)]">
            <tr>
              <th className="px-3 py-2.5 font-medium">Reg. ID</th>
              <th className="px-3 py-2.5 font-medium">Group ID</th>
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Category</th>
              <th className="px-3 py-2.5 font-medium">Contact</th>
              <th className="px-3 py-2.5 font-medium">BIB</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Amount</th>
              <th className="px-3 py-2.5 font-medium">Registered</th>
              <th className="w-px px-3 py-2.5 font-medium"></th>
              <th className="w-px px-3 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-neutral-300">
                  {r.registration_code ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {r.group_id && r.registration_groups?.booking_code ? (
                    <Link
                      href={{ pathname: "/admin/registrations", query: { group: r.group_id } }}
                      className="font-mono text-xs text-neutral-300 underline decoration-white/30 hover:text-neutral-100"
                    >
                      {r.registration_groups.booking_code}
                    </Link>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {r.full_name}
                  {r.group_id && r.registration_groups && r.registration_groups.attendee_count > 1 && (
                    <Link
                      href={{ pathname: "/admin/registrations", query: { group: r.group_id } }}
                      className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300 hover:bg-white/20"
                    >
                      ×{r.registration_groups.attendee_count}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2.5">{r.ticket_categories?.name}</td>
                <td className="px-3 py-2.5">
                  <div>{r.email}</div>
                  <div className="text-neutral-500">{r.phone}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-neutral-300">{r.bib_number ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={r.payment_status} />
                    <DirectPaymentFlag row={r} />
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  ₹{Number(r.amount_inr).toLocaleString("en-IN")}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-neutral-400">
                  {new Date(r.created_at).toLocaleDateString("en-IN")}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {r.payment_status === "paid" && <ResendWaButton registrationId={r.id} />}
                  {(r.payment_status === "pending" || r.payment_status === "failed") && (
                    <MarkPaidButton registrationId={r.id} name={r.full_name} />
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <EditRegistrationButton registration={r} categories={categoryRows} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-neutral-500">
                  No registrations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{
                pathname: "/admin/registrations",
                query: {
                  ...(q ? { q } : {}),
                  ...(status ? { status } : {}),
                  ...(method ? { method } : {}),
                  ...(groupId ? { group: groupId } : {}),
                  page: p,
                },
              }}
              className={`rounded-md px-3 py-1 ${
                p === pageNum ? "bg-emerald-500 text-neutral-950" : "border border-white/10 text-neutral-300"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-400",
    pending: "bg-amber-500/15 text-amber-400",
    failed: "bg-red-500/15 text-red-400",
    refunded: "bg-neutral-500/15 text-neutral-400",
    cancelled: "bg-neutral-500/15 text-neutral-400",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-emerald-400">₹{value.toLocaleString("en-IN")}</p>
      <p className="text-xs text-neutral-500">{sub}</p>
    </div>
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
    <span
      title={details}
      className="cursor-help rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-300"
    >
      Direct · {label}
    </span>
  );
}
