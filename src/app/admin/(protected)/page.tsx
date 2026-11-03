import Link from "next/link";
import { getAdminEvent } from "@/lib/admin-event";
import { getDashboardStats } from "@/lib/admin-data";

export default async function AdminDashboardPage() {
  const { event } = await getAdminEvent();
  if (!event) {
    return <p className="text-neutral-400">No active event found.</p>;
  }

  const stats = await getDashboardStats(event.id);
  const { totals } = stats;

  return (
    <div>
      <h1 className="text-2xl font-bold">{event.name}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Paid Registrations" value={totals.paidCount.toLocaleString("en-IN")} />
        <StatCard label="Total Revenue" value={`₹${totals.revenue.toLocaleString("en-IN")}`} />
        <StatCard
          label="Via Razorpay"
          value={`₹${totals.razorpay.amount.toLocaleString("en-IN")}`}
          sub={`${totals.razorpay.count.toLocaleString("en-IN")} paid`}
        />
        <Link
          href={{ pathname: "/admin/registrations", query: { method: "direct", status: "paid" } }}
          className="block rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-5 hover:border-sky-400/60"
        >
          <p className="text-sm text-sky-300">Collected directly (not Razorpay)</p>
          <p className="mt-1 text-2xl font-bold text-sky-300">₹{totals.direct.amount.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {totals.direct.count} paid · ₹{totals.manual.amount.toLocaleString("en-IN")} manual override · ₹
            {totals.bulkImport.amount.toLocaleString("en-IN")} bulk import
          </p>
        </Link>
      </div>

      {stats.pocTotals.length > 0 && (
        <>
          <h2 className="mt-10 font-semibold text-lg">By Group POC</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Bulk-imported registrations, grouped by the POC responsible for collecting their money.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-left text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">POC</th>
                  <th className="px-4 py-3 font-medium">Registrations</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.pocTotals.map((p) => (
                  <tr key={p.pocName} className="border-t border-white/10">
                    <td className="px-4 py-3">
                      <Link
                        href={{ pathname: "/admin/registrations", query: { q: p.pocName } }}
                        className="underline decoration-white/30 hover:decoration-white"
                      >
                        {p.pocName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{p.count.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">₹{p.amount.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="mt-10 font-semibold text-lg">By Category</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Sold</th>
            </tr>
          </thead>
          <tbody>
            {stats.categories.map((c) => (
              <tr key={c.id} className="border-t border-white/10">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3">{c.sold_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-emerald-400">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
