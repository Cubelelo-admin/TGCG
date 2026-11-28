import { requireAdmin, VOLUNTEER_ROLES } from "@/lib/admin-auth";
import Link from "next/link";
import { listSiteAssets } from "@/lib/site-assets";
import { getWaGroupSettings } from "@/lib/app-settings";
import { Banner, EmptyState, Icon, PageHeader } from "@/components/ds";
import UploadAssetCard from "./UploadAssetCard";
import WhatsAppGroupsCard from "./WhatsAppGroupsCard";
import VolunteersCard, { type Volunteer } from "./VolunteersCard";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminEvent } from "@/lib/admin-event";
import { listStations } from "@/lib/expo";
import type { IconName } from "@/components/ds";

const TABS = [
  { id: "race-assets", label: "Race Assets" },
  { id: "wa-group", label: "WA Group" },
  { id: "volunteers", label: "Volunteers" },
] as const;
const TAB_ICONS: Record<TabId, IconName> = { "race-assets": "file", "wa-group": "whatsapp", volunteers: "users" };
type TabId = (typeof TABS)[number]["id"];

export default async function AdminConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { tab } = await searchParams;
  const activeTab: TabId = TABS.find((t) => t.id === tab)?.id ?? "race-assets";

  return (
    <div>
      <PageHeader title="Configuration" />

      {/* Dock underline tabs, rendered as links so the active tab lives in the URL. */}
      <div role="tablist" className="flex gap-5 border-b border-line-secondary">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <Link
              key={t.id}
              role="tab"
              aria-selected={active}
              href={{ pathname: "/admin/assets", query: t.id === "race-assets" ? {} : { tab: t.id } }}
              className={`-mb-px flex items-center gap-2 border-b-2 pb-2.5 pt-2 text-14 ${
                active
                  ? "border-ink-disabled font-medium text-ink"
                  : "border-transparent text-ink-tertiary hover:text-ink"
              }`}
            >
              <Icon name={TAB_ICONS[t.id]} size={16} />
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-5">
        {activeTab === "race-assets" ? <RaceAssetsTab /> : activeTab === "wa-group" ? <WaGroupTab /> : <VolunteersTab />}
      </div>
    </div>
  );
}

async function RaceAssetsTab() {
  const { assets, error } = await listSiteAssets();

  return (
    <div>
      <p className="max-w-2xl text-14 text-ink-tertiary">
        Upload the PDFs linked from the ticket page. Replacing a file here updates the link
        everywhere it&apos;s used — attendees always land on the latest version.
      </p>

      {error && (
        <div className="mt-5">
          <Banner tone="danger" title="Assets aren't set up in the database yet.">
            <p>
              Run migration <code className="font-mono">0015_site_assets.sql</code> in the Supabase SQL
              editor, then reload this page.
            </p>
            <p className="mt-1 break-all font-mono text-ink-tertiary">{error}</p>
          </Banner>
        </div>
      )}

      {!error && assets.length === 0 && (
        <div className="mt-5 rounded-12 border border-line bg-white">
          <EmptyState title="No assets found." />
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => (
          <UploadAssetCard key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}

async function WaGroupTab() {
  const waGroupSettings = await getWaGroupSettings();
  return <WhatsAppGroupsCard settings={waGroupSettings} />;
}

async function VolunteersTab() {
  const [{ data, error }, { event }] = await Promise.all([
    createServiceClient()
      .from("admin_allowlist")
      .select("email, role, added_at, desk, picker_items")
      .order("added_at", { ascending: true }),
    getAdminEvent(),
  ]);
  if (error) {
    console.error("volunteers load failed", error);
    return (
      <Banner tone="danger" title="Could not load volunteers">
        Refresh the page; if it keeps failing, check the server logs.
      </Banner>
    );
  }
  // The desks a desk volunteer can be given: this event's pigeonhole stations.
  const stations = event ? await listStations(event.id) : [];
  const rows = (data ?? []) as {
    email: string;
    role: string;
    added_at: string;
    desk: string | null;
    picker_items: string[] | null;
  }[];
  const volunteers: Volunteer[] = rows
    .filter((r) => (VOLUNTEER_ROLES as readonly string[]).includes(r.role))
    .map((r) => ({
      email: r.email,
      role: r.role as Volunteer["role"],
      addedAt: r.added_at,
      desk: r.desk,
      items: (r.picker_items ?? []) as Volunteer["items"],
    }));
  return (
    <VolunteersCard
      volunteers={volunteers}
      stations={stations}
      adminCount={rows.filter((r) => r.role === "admin").length}
    />
  );
}
