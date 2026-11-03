import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { TSHIRT_SIZES } from "@/lib/registration-schema";

export interface RegistrationRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  gender: string | null;
  tshirt_size: string | null;
  payment_status: string;
  amount_inr: number;
  registration_code: string | null;
  bib_number: string | null;
  checked_in: boolean;
  created_at: string;
  group_id: string | null;
  ticket_category_id: string;
  payment_method: string;
  manual_payment_mode: string | null;
  manual_payment_ref: string | null;
  manual_payment_note: string | null;
  manual_paid_by: string | null;
  manual_paid_at: string | null;
  poc_name: string | null;
  registration_groups: { attendee_count: number; organizer_email: string; booking_code: string | null } | null;
  ticket_categories: { name: string; group: string; hidden_from_picker: boolean } | null;
}

export type PaymentTotals = {
  paidCount: number;
  revenue: number;
  razorpay: { count: number; amount: number };
  /** Everything not settled through Razorpay (manual override + bulk import). */
  direct: { count: number; amount: number };
  manual: { count: number; amount: number };
  bulkImport: { count: number; amount: number };
};

/** Paid totals split by payment method — aggregated in Postgres (see 0019_manual_payments.sql). */
export async function getPaymentTotals(eventId: string): Promise<PaymentTotals> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("payment_totals", { p_event_id: eventId });
  if (error) console.error("payment_totals failed", error);

  const rows = (data ?? []) as { payment_method: string; paid_count: number; amount_inr: number }[];
  const pick = (method: string) => {
    const row = rows.find((r) => r.payment_method === method);
    return { count: Number(row?.paid_count ?? 0), amount: Number(row?.amount_inr ?? 0) };
  };

  const razorpay = pick("razorpay");
  const manual = pick("manual");
  const bulkImport = pick("bulk_import");
  const direct = { count: manual.count + bulkImport.count, amount: manual.amount + bulkImport.amount };
  return {
    paidCount: razorpay.count + direct.count,
    revenue: razorpay.amount + direct.amount,
    razorpay,
    direct,
    manual,
    bulkImport,
  };
}

export type PocTotal = { pocName: string; count: number; amount: number };

/** Paid bulk-import registrations per group POC — who is collecting how much (see 0021_poc_and_multi_event.sql). */
export async function getPocTotals(eventId: string): Promise<PocTotal[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("poc_totals", { p_event_id: eventId });
  if (error) {
    console.error("poc_totals failed", error);
    return [];
  }
  return ((data ?? []) as { poc_name: string; paid_count: number; amount_inr: number }[]).map((r) => ({
    pocName: r.poc_name,
    count: Number(r.paid_count),
    amount: Number(r.amount_inr),
  }));
}

export type TshirtCount = { size: string; count: number };

/**
 * T-shirts to order: paid registrations per size, in size-chart order, plus
 * an "Other" bucket for any value outside the standard list (e.g. a typo
 * from an older import) so the total always matches. Each size is a
 * head-only exact count, so this stays correct past PostgREST's 1000-row
 * response cap without a dedicated RPC. Child Runner has no T-shirt
 * (tshirt_size is null) and isn't counted.
 */
export async function getTshirtCounts(eventId: string): Promise<TshirtCount[]> {
  const supabase = createServiceClient();
  const base = () =>
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("payment_status", "paid");

  const [sized, other] = await Promise.all([
    Promise.all(TSHIRT_SIZES.map((size) => base().eq("tshirt_size", size))),
    base()
      .not("tshirt_size", "is", null)
      .not("tshirt_size", "in", `(${TSHIRT_SIZES.join(",")})`),
  ]);

  const counts: TshirtCount[] = TSHIRT_SIZES.map((size, i) => {
    if (sized[i].error) console.error("tshirt count failed", size, sized[i].error);
    return { size, count: sized[i].count ?? 0 };
  });
  if (other.error) console.error("tshirt count failed (other)", other.error);
  if (other.count) counts.push({ size: "Other", count: other.count });
  return counts;
}

export async function getDashboardStats(eventId: string) {
  const supabase = createServiceClient();

  const [totals, pocTotals, tshirtCounts, { data: categories }] = await Promise.all([
    getPaymentTotals(eventId),
    getPocTotals(eventId),
    getTshirtCounts(eventId),
    supabase
      .from("ticket_categories")
      .select("id, name, sold_count")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
  ]);

  return {
    totals,
    pocTotals,
    tshirtCounts,
    categories: categories ?? [],
  };
}

/** "direct" = anything not paid through Razorpay. */
export const PAYMENT_METHOD_FILTERS = ["razorpay", "direct", "manual", "bulk_import"] as const;

export async function listRegistrations(params: {
  eventId: string;
  search?: string;
  status?: string;
  groupId?: string;
  method?: string;
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
      "id, full_name, email, phone, city, gender, tshirt_size, payment_status, amount_inr, registration_code, bib_number, checked_in, created_at, group_id, ticket_category_id, payment_method, manual_payment_mode, manual_payment_ref, manual_payment_note, manual_paid_by, manual_paid_at, poc_name, registration_groups(attendee_count, organizer_email, booking_code), ticket_categories(name, group, hidden_from_picker)",
      { count: "exact" }
    )
    .eq("event_id", params.eventId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) {
    query = query.eq("payment_status", params.status);
  }
  if (params.method === "direct") {
    query = query.neq("payment_method", "razorpay");
  } else if (params.method) {
    query = query.eq("payment_method", params.method);
  }
  if (params.groupId) {
    query = query.eq("group_id", params.groupId);
  }
  if (params.search) {
    const term = params.search.trim();
    query = query.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,registration_code.ilike.%${term}%,poc_name.ilike.%${term}%`
    );
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("listRegistrations failed", error);
    return { rows: [] as RegistrationRow[], count: 0, page, pageSize };
  }

  return { rows: (data ?? []) as unknown as RegistrationRow[], count: count ?? 0, page, pageSize };
}
