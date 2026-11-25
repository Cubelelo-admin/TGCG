import Link from "next/link";
import { getAdminEvent } from "@/lib/admin-event";
import { getKitOverview } from "@/lib/kit";
import { Card, EmptyState, Icon, KpiCard, KpiRow, PageHeader, buttonClass, type IconName } from "@/components/ds";
import { GenerateBoxesButton, PocTable, ResetBoxesButton } from "./KitControls";

const STATUSES = ["open", "ready", "staged", "handed_over", "collected"] as const;

const STATIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/kit/pick", label: "Pick & pack", icon: "scan" },
  { href: "/admin/kit/handover", label: "Stage / day-0 handover", icon: "handover" },
  { href: "/admin/kit/counter", label: "Expo counter", icon: "userCheck" },
  { href: "/admin/kit/exceptions", label: "Exceptions desk", icon: "warning" },
];

const LABEL_LINKS: { href: string; label: string }[] = [
  { href: "/admin/kit/labels?type=bags", label: "Print bag labels" },
  { href: "/admin/kit/labels?type=groups", label: "Print group-box labels" },
  { href: "/admin/kit/labels?type=bins", label: "Print bin labels" },
];

export default async function KitPage() {
  const { event } = await getAdminEvent();
  if (!event) return <EmptyState title="No event found." />;

  const { status, pocs, channels } = await getKitOverview(event.id);
  const count = (kind: string, s: string) =>
    Number(status.find((r) => r.kind === kind && r.status === s)?.box_count ?? 0);
  const expo = channels.find((c) => c.kit_channel === "expo");
  const corp = channels.find((c) => c.kit_channel === "corporate");
  const unboxed = Number(expo?.paid_count ?? 0) - Number(expo?.boxed_count ?? 0) +
    (Number(corp?.paid_count ?? 0) - Number(corp?.boxed_count ?? 0));

  const channelCard = (label: string, c: typeof expo) => {
    const paid = Number(c?.paid_count ?? 0);
    const boxed = Number(c?.boxed_count ?? 0);
    return (
      <div className="flex min-w-[220px] flex-1">
        <KpiCard
          tone="bordered"
          label={label}
          value={paid.toLocaleString("en-IN")}
          caption={`${boxed.toLocaleString("en-IN")} boxed · ${(paid - boxed).toLocaleString("en-IN")} without a box`}
        />
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Kit distribution"
        subtitle={
          <>
            {event.name}. Corporate groups are handed to a company rep on day 0; everyone else collects at the expo.
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {STATIONS.map((s) => (
          <Link key={s.href} href={s.href} className={buttonClass({ variant: "outline" })}>
            <Icon name={s.icon} size={16} />
            {s.label}
          </Link>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
        {LABEL_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={buttonClass({ variant: "outline" })}>
            <Icon name="print" size={16} />
            {l.label}
          </Link>
        ))}
      </div>

      {(["expo_bag", "group_box"] as const).map((kind) => (
        <section key={kind} className="mb-2">
          <h2 className="mb-3 text-16 font-semibold text-ink">
            {kind === "expo_bag" ? "Expo bags" : "Corporate group boxes"}
          </h2>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {STATUSES.map((s) => (
              <div key={s} className="flex min-w-0">
                <KpiCard tone="bordered" eyebrow label={s.replace("_", " ")} value={count(kind, s).toLocaleString("en-IN")} />
              </div>
            ))}
          </div>
        </section>
      ))}

      <Card className="mb-6" title={`${unboxed.toLocaleString("en-IN")} paid runners have no box yet`}>
        <p className="text-14 text-ink-tertiary">
          Set each group&apos;s channel below first. Boxes can&apos;t be re-routed once created. Run this again after
          late registrations.
        </p>
        <div className="mt-4">
          <KpiRow>
            {channelCard("Expo runners (paid)", expo)}
            {channelCard("Corporate runners (paid)", corp)}
          </KpiRow>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <ResetBoxesButton eventId={event.id} />
          <GenerateBoxesButton eventId={event.id} />
        </div>
      </Card>

      <Card title="Groups (by POC)">
        <p className="-mt-2 mb-4 text-14 text-ink-tertiary">
          Runners with no POC are individual expo runners. Make a POC corporate to pack its runners into numbered group
          boxes for day 0.
        </p>
        <PocTable eventId={event.id} pocs={pocs} />
      </Card>
    </div>
  );
}
