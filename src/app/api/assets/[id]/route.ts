import { NextResponse } from "next/server";
import { getSiteAsset, getSiteAssetPublicUrl, isSiteAssetId, type SiteAssetId } from "@/lib/site-assets";

export const runtime = "nodejs";

// Where a link goes while its PDF is not uploaded yet (temporary 307, so nothing caches it).
const NOT_UPLOADED_FALLBACK: Partial<Record<SiteAssetId, string>> = {
  "raigarh-race-information": "/raigarh/race-info",
};

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
    // A link already printed somewhere permanent (a WhatsApp template's static button) lands on the
    // event's own page until its PDF is uploaded, instead of an error.
    const fallback = NOT_UPLOADED_FALLBACK[id];
    if (fallback) return NextResponse.redirect(new URL(fallback, request.url), 307);
    return NextResponse.json({ error: "Not uploaded yet" }, { status: 404 });
  }

  const url = getSiteAssetPublicUrl(asset.pdf_path);
  return NextResponse.redirect(url);
}
