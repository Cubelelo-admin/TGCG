import Link from "next/link";
import { listSiteAssets } from "@/lib/site-assets";
import { getWaGroupSettings } from "@/lib/app-settings";
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
      <h1 className="text-xl font-bold sm:text-2xl">Configuration</h1>

      <div className="mt-5 flex gap-2 border-b border-white/10">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={{ pathname: "/admin/assets", query: t.id === "race-assets" ? {} : { tab: t.id } }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === t.id
                ? "border-emerald-400 text-neutral-50"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "race-assets" ? <RaceAssetsTab /> : <WaGroupTab />}
      </div>
    </div>
  );
}

async function RaceAssetsTab() {
  const { assets, error } = await listSiteAssets();

  return (
    <div>
      <p className="max-w-2xl text-sm text-neutral-400">
        Upload the PDFs linked from the ticket page. Replacing a file here updates the link
        everywhere it&apos;s used — attendees always land on the latest version.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          <p className="font-semibold">Assets aren&apos;t set up in the database yet.</p>
          <p className="mt-1 text-amber-300/80">
            Run migration <code className="font-mono">0015_site_assets.sql</code> in the Supabase SQL
            editor, then reload this page.
          </p>
          <p className="mt-2 font-mono text-xs text-amber-300/60">{error}</p>
        </div>
      )}

      {!error && assets.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">No assets found.</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
