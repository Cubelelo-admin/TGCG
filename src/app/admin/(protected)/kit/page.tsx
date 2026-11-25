import Link from "next/link";
import { getAdminEvent } from "@/lib/admin-event";
import { getKitOverview } from "@/lib/kit";
import { ChannelToggle, GenerateBoxesButton, ResetBoxesButton } from "./KitControls";

const STATUSES = ["open", "ready", "staged", "handed_over", "collected"] as const;

export default async function KitPage() {
  const { event } = await getAdminEvent();
  if (!event) return <p className="text-neutral-400">No event found.</p>;

  const { status, pocs, channels } = await getKitOverview(event.id);
  const count = (kind: string, s: string) =>
    Number(status.find((r) => r.kind === kind && r.status === s)?.box_count ?? 0);
  const expo = channels.find((c) => c.kit_channel === "expo");
  const corp = channels.find((c) => c.kit_channel === "corporate");
  const unboxed = Number(expo?.paid_count ?? 0) - Number(expo?.boxed_count ?? 0) +
    (Number(corp?.paid_count ?? 0) - Number(corp?.boxed_count ?? 0));

  return (
    <div>
      <h1 className="text-2xl font-bold">Kit distribution</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {event.name}. Corporate groups are handed to a company rep on day 0; everyone else collects at the expo.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {[
          ["/admin/kit/pick", "Pick & pack"],
          ["/admin/kit/handover", "Stage / day-0 handover"],
          ["/admin/kit/counter", "Expo counter"],
          ["/admin/kit/labels?type=bags", "Print bag labels"],
          ["/admin/kit/labels?type=groups", "Print group-box labels"],
          ["/admin/kit/labels?type=bins", "Print bin labels"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10">
            {label}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(["expo_bag", "group_box"] as const).map((kind) => (
          <div key={kind} className="rounded-xl border border-white/10 p-4">
            <p className="font-semibold">{kind === "expo_bag" ? "Expo bags" : "Corporate group boxes"}</p>
            <div className="mt-3 grid grid-cols-5 gap-2 text-center">
              {STATUSES.map((s) => (
                <div key={s}>
                  <p className="text-2xl font-bold">{count(kind, s)}</p>
                  <p className="text-[11px] uppercase tracking-wide text-neutral-400">{s.replace("_", " ")}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-white/10 p-4">
        <div>
          <p className="font-semibold">{unboxed.toLocaleString("en-IN")} paid runners have no box yet</p>
          <p className="mt-1 text-sm text-neutral-400">
            Set each group&apos;s channel below first. Boxes can&apos;t be re-routed once created. Run this again after
            late registrations.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <ResetBoxesButton eventId={event.id} />
          <GenerateBoxesButton eventId={event.id} />
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold">Groups (by POC)</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Runners with no POC are individual expo runners. Make a POC corporate to pack its runners into numbered group
        boxes for day 0.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">POC / group</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Boxed</th>
              <th className="px-4 py-3 font-medium">Channel</th>
            </tr>
          </thead>
          <tbody>
            {pocs.map((p) => (
              <tr key={p.poc_name} className="border-t border-white/10">
                <td className="px-4 py-3">{p.poc_name}</td>
                <td className="px-4 py-3">{Number(p.paid_count)}</td>
                <td className="px-4 py-3">{Number(p.boxed_count)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <ChannelToggle
                      eventId={event.id}
                      pocName={p.poc_name}
                      corporate={Number(p.corporate_count)}
                      total={Number(p.paid_count)}
                    />
                    {Number(p.boxed_count) > 0 && (
                      <ResetBoxesButton eventId={event.id} pocName={p.poc_name} label="Reset boxes" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {pocs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  No POC groups for this event
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
