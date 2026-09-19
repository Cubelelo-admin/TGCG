import { NextResponse } from "next/server";
import { getSiteAsset, getSiteAssetPublicUrl, isSiteAssetId } from "@/lib/site-assets";

export const runtime = "nodejs";

/**
 * Stable public link for a race-info PDF, used from the ticket page. Always
 * resolves to whatever the admin has most recently uploaded for this asset
 * id — the redirect target only changes when the file itself is replaced.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSiteAssetId(id)) {
    return NextResponse.json({ error: "Unknown asset" }, { status: 404 });
  }

  const asset = await getSiteAsset(id);
  if (!asset?.pdf_path) {
    return NextResponse.json({ error: "Not uploaded yet" }, { status: 404 });
  }

  const url = getSiteAssetPublicUrl(asset.pdf_path);
  return NextResponse.redirect(url);
}
