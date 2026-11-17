import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminEvent } from "@/lib/admin-event";
import { buildRegistrationSearchFilter, parseSearchField } from "@/lib/registration-search";

export const runtime = "nodejs";

const COLUMNS = [
  "registration_code",
  "group_id",
  "full_name",
  "email",
  "phone",
  "gender",
  "city",
  "organization",
  "running_community",
  "date_of_birth",
  "tshirt_size",
  "emergency_phone",
  "aadhar_number",
  "bank_name_location",
  "bank_account_number",
  "bank_ifsc",
  "pan_number",
  "govt_id_drive_link",
  "ticket_category",
  "payment_status",
  "payment_method",
  "manual_payment_mode",
  "manual_payment_ref",
  "manual_payment_note",
  "manual_paid_by",
  "manual_paid_at",
  "poc_name",
  "amount_inr",
  "category_adjustment_inr",
  "category_changes",
  "bib_number",
  "checked_in",
  "created_at",
] as const;

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { event } = await getAdminEvent();
  if (!event) {
    return NextResponse.json({ error: "No active event" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const status = searchParams.get("status");
  const method = searchParams.get("method");
  const field = parseSearchField(searchParams.get("field"));

  const supabase = createServiceClient();
  let query = supabase
    .from("registrations")
    .select(
      "id, registration_code, group_id, full_name, email, phone, gender, city, organization, running_community, date_of_birth, tshirt_size, emergency_phone, aadhar_number, bank_name_location, bank_account_number, bank_ifsc, pan_number, govt_id_drive_file_id, payment_status, payment_method, manual_payment_mode, manual_payment_ref, manual_payment_note, manual_paid_by, manual_paid_at, poc_name, amount_inr, bib_number, checked_in, created_at, ticket_categories(name)"
    )
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("payment_status", status);
  if (method === "direct") query = query.neq("payment_method", "razorpay");
  else if (method) query = query.eq("payment_method", method);
  const searchFilter = await buildRegistrationSearchFilter(supabase, event.id, q, field);
  if (searchFilter) query = query.or(searchFilter);

  const [{ data, error }, { data: adjustmentRows }] = await Promise.all([
    query,
    // Small table — fetch the whole event's rather than an id list that could overflow the URL.
    supabase
      .from("registration_adjustments")
      .select("registration_id, from_category_name, to_category_name, amount_inr, mode, reference, poc_name, created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true }),
  ]);
  if (error) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  type Adjustment = {
    registration_id: string;
    from_category_name: string | null;
    to_category_name: string | null;
    amount_inr: number;
    mode: string | null;
    reference: string | null;
    poc_name: string | null;
    created_at: string;
  };
  const adjustmentsByReg = new Map<string, Adjustment[]>();
  for (const a of (adjustmentRows ?? []) as Adjustment[]) {
    adjustmentsByReg.set(a.registration_id, [...(adjustmentsByReg.get(a.registration_id) ?? []), a]);
  }

  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & { ticket_categories: { name: string } | null }
  >;

  const lines = [COLUMNS.join(",")];
  for (const row of rows) {
    const values = COLUMNS.map((col) => {
      if (col === "ticket_category") return csvEscape(row.ticket_categories?.name);
      if (col === "category_adjustment_inr") {
        const list = adjustmentsByReg.get(row.id as string) ?? [];
        return csvEscape(list.length ? list.reduce((sum, a) => sum + Number(a.amount_inr), 0) : "");
      }
      if (col === "category_changes") {
        const list = adjustmentsByReg.get(row.id as string) ?? [];
        return csvEscape(
          list
            .map((a) =>
              [
                `${a.from_category_name ?? "?"} -> ${a.to_category_name ?? "?"}`,
                `${Number(a.amount_inr)}`,
                a.mode,
                a.reference && `ref ${a.reference}`,
                a.poc_name && `POC ${a.poc_name}`,
                new Date(a.created_at).toLocaleDateString("en-IN"),
              ]
                .filter(Boolean)
                .join(" / ")
            )
            .join("; ")
        );
      }
      if (col === "govt_id_drive_link") {
        const fileId = row.govt_id_drive_file_id;
        return csvEscape(fileId ? `https://drive.google.com/file/d/${fileId}/view` : "");
      }
      return csvEscape(row[col]);
    });
    lines.push(values.join(","));
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-registrations-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
