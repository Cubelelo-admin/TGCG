import { requireAdmin } from "@/lib/admin-auth";
import QRCode from "qrcode";
import Link from "next/link";
import { getAdminEvent } from "@/lib/admin-event";
import { createServiceClient } from "@/lib/supabase/server";
import { KIT_BIN_CODES } from "@/lib/kit";
import { loadBibFileLabels, loadCrateLabels } from "@/lib/expo";
import { Card, EmptyState, PageHeader } from "@/components/ds";
import PrintButton from "./PrintButton";

type Label = { code: string; title: string; lines: string[]; qr: string };

const qr = (text: string) => QRCode.toDataURL(text, { margin: 1, width: 220, errorCorrectionLevel: "M" });

export default async function KitLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; group?: string }>;
}) {
  await requireAdmin();
  const { type = "bags", group } = await searchParams;
  const { event } = await getAdminEvent();
  if (!event) return <EmptyState title="No event found." />;

  const labels: Label[] = [];

  // Bins and crates are scanned by pickers and restock on the expo floor: bigger labels.
  const large = type === "bins" || type === "crates";

  if (type === "bins") {
    for (const code of KIT_BIN_CODES) {
      labels.push({
        code,
        title: code,
        lines: [code === "PACK" ? "Accessory pack: clips, bottle, bag, napkin" : `T-shirt size ${code.slice(3)}`],
        qr: await qr(code),
      });
    }
    // BIB files (files of 100 numbers): one per file holding an expo runner's BIB.
    for (const f of await loadBibFileLabels(event.id)) {
      const [, from, to] = f.code.split("-");
      labels.push({
        code: f.code,
        title: f.code === "BF-MISC" ? "BIB misc" : `BIB ${from}–${to}`,
        lines: [
          f.code === "BF-MISC" ? "BIBs outside the numbered files" : (f.category ?? "BIB file"),
          `${f.count} expo BIB${f.count === 1 ? "" : "s"} today`,
        ],
        qr: await qr(f.code),
      });
    }
  } else if (type === "crates") {
    for (const c of await loadCrateLabels(event.id)) {
      labels.push({
        code: c.label,
        title: c.label,
        // Short lines: the label prints at text-14 and truncates anything longer.
        lines: [`Desk ${c.station} pigeonhole`, c.size === "small" ? "Small: one runner" : "Large: group order"],
        qr: await qr(c.label),
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
          title={
            type === "bins" ? "Bin labels" : type === "crates" ? "Pigeonhole labels" : type === "groups" ? "Group-box labels" : "Expo bag labels"
          }
          subtitle={
            <>
              {labels.length} labels. Print on A4 sticker sheets (turn headers and footers off in the print dialog).{" "}
              {type === "bins" &&
                "BIB files are worked out from today's paid expo runners: reprint after registrations close so every file has a label. "}
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
      {/* Printed labels: bag / group-box sizes are deliberately unchanged; bins and crates print
          two to a row with a bigger QR so a phone camera reads them from arm's length. */}
      <div
        className={`mt-6 grid gap-3 print:mt-0 ${large ? "grid-cols-1 sm:grid-cols-2 print:grid-cols-2" : "grid-cols-2 sm:grid-cols-3 print:grid-cols-3"}`}
      >
        {labels.map((l) => (
          <div
            key={l.code}
            className={`flex break-inside-avoid items-center rounded-4 border border-[#999] bg-[#fff] text-[#000] ${large ? "gap-4 p-3" : "gap-3 p-2"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.qr} alt={l.code} width={large ? 150 : 84} height={large ? 150 : 84} className="shrink-0" />
            <div className="min-w-0">
              <p className={`truncate font-semibold leading-none ${large ? "text-32" : "text-24"}`}>{l.title}</p>
              {l.lines.map((line, i) => (
                // Print-only exception: 11px has no Dock step but fits the sticker layout.
                <p key={i} className={`mt-1 truncate leading-tight ${large ? "text-14" : "text-[11px]"}`}>
                  {line}
                </p>
              ))}
              <p className={`mt-1 font-mono text-[#525252] ${large ? "text-12" : "text-10"}`}>{l.code}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
