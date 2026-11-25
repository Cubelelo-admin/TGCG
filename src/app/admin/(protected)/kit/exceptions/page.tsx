import { getAdminEvent } from "@/lib/admin-event";
import { getRecentExceptions } from "@/lib/kit";
import ExceptionsDesk from "./ExceptionsDesk";

export default async function KitExceptionsPage() {
  const { event } = await getAdminEvent();
  if (!event) return <p className="text-neutral-400">No event found.</p>;

  const recent = await getRecentExceptions(event.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Exceptions desk</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {event.name}. Size swaps, lost passes, unpaid runners, late sign-ups and kits handed over without a bag scan.
        Search by name, mobile, BIB or pass code. Every change is logged with who made it.
      </p>

      <div className="mt-6">
        <ExceptionsDesk eventId={event.id} />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Recent exceptions and rejected scans</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">When (IST)</th>
              <th className="px-4 py-3 font-medium">What</th>
              <th className="px-4 py-3 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((e) => (
              <tr key={e.id} className="border-t border-white/10 align-top">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-400">
                  {new Date(e.createdAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className={e.ok ? "" : "text-red-400"}>
                    {e.ok ? "" : "Rejected scan: "}
                    {e.detail ?? e.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-400">{e.actor ?? "-"}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-neutral-500">
                  Nothing yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
