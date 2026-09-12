import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getEvent } from "@/lib/catalog";

export const runtime = "nodejs";

const COLUMNS = [
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
  "ticket_category",
  "payment_status",
  "amount_inr",
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

  const event = await getEvent();
  if (!event) {
    return NextResponse.json({ error: "No active event" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const status = searchParams.get("status");

  const supabase = createServiceClient();
  let query = supabase
    .from("registrations")
    .select(
      "full_name, email, phone, gender, city, organization, running_community, date_of_birth, tshirt_size, emergency_phone, aadhar_number, bank_name_location, bank_account_number, bank_ifsc, pan_number, payment_status, amount_inr, bib_number, checked_in, created_at, ticket_categories(name)"
    )
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("payment_status", status);
  if (q) {
    const term = q.trim();
    query = query.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & { ticket_categories: { name: string } | null }
  >;

  const lines = [COLUMNS.join(",")];
  for (const row of rows) {
    const values = COLUMNS.map((col) =>
      col === "ticket_category"
        ? csvEscape(row.ticket_categories?.name)
        : csvEscape(row[col])
    );
    lines.push(values.join(","));
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tgcg-registrations-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
