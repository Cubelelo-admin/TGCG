import Link from "next/link";
import { getBulkImportCategories, getEvent } from "@/lib/catalog";
import { listRegistrations } from "@/lib/admin-data";
import ResendWaButton from "./ResendWaButton";
import EditRegistrationButton from "./EditRegistrationButton";
import BulkUploadButton from "./BulkUploadButton";

const STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"] as const;

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; group?: string; page?: string }>;
}) {
  const { q, status, group: groupId, page } = await searchParams;
  const event = await getEvent();
  if (!event) return <p className="text-neutral-400">No active event found.</p>;

  const pageNum = Number(page) || 1;
  const { rows, count, pageSize } = await listRegistrations({
    eventId: event.id,
    search: q,
    status,
    groupId,
    page: pageNum,
  });

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const exportHref = `/api/admin/export?${new URLSearchParams({
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
  }).toString()}`;

  const categoryRows = await getBulkImportCategories(event.id);

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
                  <StatusBadge status={r.payment_status} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  ₹{Number(r.amount_inr).toLocaleString("en-IN")}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-neutral-400">
                  {new Date(r.created_at).toLocaleDateString("en-IN")}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {r.payment_status === "paid" && <ResendWaButton registrationId={r.id} />}
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
                query: { ...(q ? { q } : {}), ...(status ? { status } : {}), page: p },
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
