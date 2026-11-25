import Link from "next/link";
import { listSiteAssets } from "@/lib/site-assets";
import { getWaGroupSettings } from "@/lib/app-settings";
import { Banner, EmptyState, Icon, PageHeader } from "@/components/ds";
import UploadAssetCard from "./UploadAssetCard";
import WhatsAppGroupsCard from "./WhatsAppGroupsCard";

const TABS = [
  { id: "race-assets", label: "Race Assets" },
  { id: "wa-group", label: "WA Group" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function AdminConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab: TabId = tab === "wa-group" ? "wa-group" : "race-assets";

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
              <Icon name={t.id === "race-assets" ? "file" : "whatsapp"} size={16} />
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-5">
        {activeTab === "race-assets" ? <RaceAssetsTab /> : <WaGroupTab />}
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
