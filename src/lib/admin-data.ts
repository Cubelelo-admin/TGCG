import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export interface RegistrationRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  gender: string;
  tshirt_size: string;
  payment_status: string;
  amount_inr: number;
  bib_number: string | null;
  checked_in: boolean;
  created_at: string;
  ticket_categories: { name: string; group: string } | null;
}

export async function getDashboardStats(eventId: string) {
  const supabase = createServiceClient();

  const [{ count: totalPaid }, { data: revenueRows }, { data: categories }] =
    await Promise.all([
      supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("payment_status", "paid"),
      supabase
        .from("registrations")
        .select("amount_inr")
        .eq("event_id", eventId)
        .eq("payment_status", "paid"),
      supabase
        .from("ticket_categories")
        .select("id, name, sold_count")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true }),
    ]);

  const revenue = (revenueRows ?? []).reduce(
    (sum, r) => sum + Number(r.amount_inr),
    0
  );

  return {
    totalPaid: totalPaid ?? 0,
    revenue,
    categories: categories ?? [],
  };
}

export async function listRegistrations(params: {
  eventId: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = createServiceClient();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("registrations")
    .select(
      "id, full_name, email, phone, city, gender, tshirt_size, payment_status, amount_inr, bib_number, checked_in, created_at, ticket_categories(name, group)",
      { count: "exact" }
    )
    .eq("event_id", params.eventId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) {
    query = query.eq("payment_status", params.status);
  }
  if (params.search) {
    const term = params.search.trim();
    query = query.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`
    );
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("listRegistrations failed", error);
    return { rows: [] as RegistrationRow[], count: 0, page, pageSize };
  }

  return { rows: (data ?? []) as unknown as RegistrationRow[], count: count ?? 0, page, pageSize };
}
