import QRCode from "qrcode";
import Link from "next/link";
import { getAdminEvent } from "@/lib/admin-event";
import { createServiceClient } from "@/lib/supabase/server";
import { KIT_BIN_CODES } from "@/lib/kit";
import { Card, EmptyState, PageHeader } from "@/components/ds";
import PrintButton from "./PrintButton";

type Label = { code: string; title: string; lines: string[]; qr: string };

const qr = (text: string) => QRCode.toDataURL(text, { margin: 1, width: 220, errorCorrectionLevel: "M" });

export default async function KitLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; group?: string }>;
}) {
  const { type = "bags", group } = await searchParams;
  const { event } = await getAdminEvent();
  if (!event) return <EmptyState title="No event found." />;

  const labels: Label[] = [];

  if (type === "bins") {
    for (const code of KIT_BIN_CODES) {
      labels.push({
        code,
        title: code,
        lines: [code === "PACK" ? "Accessory pack: clips, bottle, bag, napkin" : `T-shirt size ${code.slice(3)}`],
        qr: await qr(code),
      });
    }
  } else {
    const supabase = createServiceClient();
    const kind = type === "groups" ? "group_box" : "expo_bag";
    const rows: Record<string, unknown>[] = [];
    // Paged: ~1,500 bags exceeds PostgREST's 1000-row response cap.
    for (let from = 0; ; from += 1000) {
      let q = supabase
        .from("kit_boxes")
        .select("code, kit_group, box_no, registrations(full_name, bib_number, tshirt_size, ticket_categories(name))")
        .eq("event_id", event.id)
        .eq("kind", kind)
        .order("code")
        .range(from, from + 999);
      if (group) q = q.eq("kit_group", group);
      const { data } = await q;
      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < 1000) break;
    }

    for (const r of rows) {
      const code = r.code as string;
      if (kind === "group_box") {
        labels.push({
          code,
          title: `${r.kit_group as string}`,
          lines: [`Box ${r.box_no as number}`],
          qr: await qr(code),
        });
      } else {
        const reg = r.registrations as {
          full_name: string;
          bib_number: string | null;
          tshirt_size: string | null;
          ticket_categories: { name: string } | null;
        } | null;
        labels.push({
          code,
          title: reg?.bib_number ?? "-",
          lines: [reg?.full_name ?? "", `${reg?.ticket_categories?.name ?? ""} · T-shirt ${reg?.tshirt_size ?? "-"}`],
          qr: await qr(code),
        });
      }
    }
  }

  return (
    <div>
      {/* On-screen chrome only: the shell and this header are hidden in print, the label grid below is what prints. */}
      <div className="print:hidden">
        <PageHeader
          title={type === "bins" ? "Bin labels" : type === "groups" ? "Group-box labels" : "Expo bag labels"}
          subtitle={
            <>
              {labels.length} labels. Print on A4 sticker sheets (turn headers and footers off in the print dialog).{" "}
              <Link href="/admin/kit" className="text-link underline decoration-dashed underline-offset-4">
                Back to kit
              </Link>
            </>
          }
          actions={<PrintButton />}
        />
        {labels.length === 0 && (
          <Card>
            <EmptyState title="No labels to print yet." />
          </Card>
        )}
      </div>
      {/* Printed labels: sizes, QR, black-on-white and break-inside-avoid are deliberately unchanged. */}
      <div className="mt-6 grid grid-cols-2 gap-3 print:mt-0 sm:grid-cols-3 print:grid-cols-3">
        {labels.map((l) => (
          <div
            key={l.code}
            className="flex break-inside-avoid items-center gap-3 rounded-4 border border-[#999] bg-[#fff] p-2 text-[#000]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.qr} alt={l.code} width={84} height={84} className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-24 font-semibold leading-none">{l.title}</p>
              {l.lines.map((line, i) => (
                // Print-only exception: 11px has no Dock step but fits the sticker layout.
                <p key={i} className="mt-1 truncate text-[11px] leading-tight">
                  {line}
                </p>
              ))}
              <p className="mt-1 font-mono text-10 text-[#525252]">{l.code}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
