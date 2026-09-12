import Link from "next/link";
import { getEvent } from "@/lib/catalog";
import { listRegistrations } from "@/lib/admin-data";
import ResendWaButton from "./ResendWaButton";

const STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"] as const;

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page } = await searchParams;
  const event = await getEvent();
  if (!event) return <p className="text-neutral-400">No active event found.</p>;

  const pageNum = Number(page) || 1;
  const { rows, count, pageSize } = await listRegistrations({
    eventId: event.id,
    search: q,
    status,
    page: pageNum,
  });

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const exportHref = `/api/admin/export?${new URLSearchParams({
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
  }).toString()}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Registrations ({count})</h1>
        <a
          href={exportHref}
          className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium hover:border-white/40"
        >
          Export CSV
        </a>
      </div>

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone"
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm focus:border-emerald-400 focus:outline-none"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm focus:border-emerald-400 focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium hover:border-white/40">
          Filter
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Registered</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="px-4 py-3">{r.full_name}</td>
                <td className="px-4 py-3">{r.ticket_categories?.name}</td>
                <td className="px-4 py-3">
                  <div>{r.email}</div>
                  <div className="text-neutral-500">{r.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.payment_status} />
                </td>
                <td className="px-4 py-3">₹{Number(r.amount_inr).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {new Date(r.created_at).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  {r.payment_status === "paid" && <ResendWaButton registrationId={r.id} />}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  No registrations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
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
