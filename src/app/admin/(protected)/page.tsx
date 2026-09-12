import { getEvent } from "@/lib/catalog";
import { getDashboardStats } from "@/lib/admin-data";

export default async function AdminDashboardPage() {
  const event = await getEvent();
  if (!event) {
    return <p className="text-neutral-400">No active event found.</p>;
  }

  const stats = await getDashboardStats(event.id);

  return (
    <div>
      <h1 className="text-2xl font-bold">{event.name}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Paid Registrations" value={stats.totalPaid.toLocaleString("en-IN")} />
        <StatCard
          label="Revenue"
          value={`₹${stats.revenue.toLocaleString("en-IN")}`}
        />
      </div>

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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-emerald-400">{value}</p>
    </div>
  );
}
