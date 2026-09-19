import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export const SITE_ASSET_IDS = ["race-information", "rules-faq", "race-day-information"] as const;
export type SiteAssetId = (typeof SITE_ASSET_IDS)[number];

export function isSiteAssetId(id: string): id is SiteAssetId {
  return (SITE_ASSET_IDS as readonly string[]).includes(id);
}

export interface SiteAsset {
  id: SiteAssetId;
  label: string;
  pdf_path: string | null;
  original_filename: string | null;
  updated_at: string;
}

export async function listSiteAssets(): Promise<{ assets: SiteAsset[]; error: string | null }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("site_assets").select("*").order("id");
  return { assets: (data ?? []) as SiteAsset[], error: error?.message ?? null };
}

export async function getSiteAsset(id: SiteAssetId): Promise<SiteAsset | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("site_assets").select("*").eq("id", id).maybeSingle();
  return data as SiteAsset | null;
}

/** Public URL for an asset's current PDF — stable across re-uploads since the storage path never changes. */
export function getSiteAssetPublicUrl(pdfPath: string): string {
  const supabase = createServiceClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from("site-assets").getPublicUrl(pdfPath);
  return publicUrl;
}

export async function uploadSiteAsset(
  id: SiteAssetId,
  file: File
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Only PDF files are allowed" };
  }

  const supabase = createServiceClient();
  const pdfPath = `${id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("site-assets")
    .upload(pdfPath, file, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { error: dbError } = await supabase
    .from("site_assets")
    .update({ pdf_path: pdfPath, original_filename: file.name, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (dbError) {
    return { ok: false, error: dbError.message };
  }

  return { ok: true };
}
