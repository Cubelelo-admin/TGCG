import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { TSHIRT_SIZES } from "@/lib/registration-schema";
import { buildRegistrationSearchFilter, type SearchField } from "@/lib/registration-search";

/** One offline money movement for a category change (0024_category_change_adjustments.sql). */
export interface RegistrationAdjustment {
  id: string;
  registration_id: string;
  from_category_name: string | null;
  to_category_name: string | null;
  price_diff_inr: number;
  amount_inr: number;
  mode: string | null;
  reference: string | null;
  note: string | null;
  poc_name: string | null;
  created_by: string | null;
  created_at: string;
}

export const ADJUSTMENT_COLUMNS =
  "id, registration_id, from_category_name, to_category_name, price_diff_inr, amount_inr, mode, reference, note, poc_name, created_by, created_at";

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
  adjustments: RegistrationAdjustment[];
}

export type PaymentTotals = {
  paidCount: number;
  revenue: number;
  razorpay: { count: number; amount: number };
  /** Everything not settled through Razorpay (manual override + bulk import). */
  direct: { count: number; amount: number };
  manual: { count: number; amount: number };
  bulkImport: { count: number; amount: number };
  /** Category-change differences settled offline (net; refunds negative). Part of `direct`. */
  categoryAdjustments: { count: number; amount: number };
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
  const categoryAdjustments = pick("category_adjustment");
  // `count` stays "paid registrations" — an adjustment isn't a new registration.
  const direct = {
    count: manual.count + bulkImport.count,
    amount: manual.amount + bulkImport.amount + categoryAdjustments.amount,
  };
  return {
    paidCount: razorpay.count + manual.count + bulkImport.count,
    revenue: razorpay.amount + direct.amount,
    razorpay,
    direct,
    manual,
    bulkImport,
    categoryAdjustments,
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
 * from an older import) so the total always matches. One grouped count in
 * Postgres (0026_tshirt_counts.sql), exact past PostgREST's 1000-row cap.
 * Child Runner has no T-shirt (tshirt_size is null) and isn't counted.
 */
export async function getTshirtCounts(eventId: string): Promise<TshirtCount[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("tshirt_counts", { p_event_id: eventId });
  if (error) console.error("tshirt_counts failed", error);

  const bySize = new Map<string, number>();
  for (const r of (data ?? []) as { tshirt_size: string; paid_count: number }[]) {
    bySize.set(r.tshirt_size, Number(r.paid_count));
  }
  const counts: TshirtCount[] = TSHIRT_SIZES.map((size) => ({ size, count: bySize.get(size) ?? 0 }));
  const known = new Set<string>(TSHIRT_SIZES);
  const other = [...bySize.entries()].filter(([size]) => !known.has(size)).reduce((n, [, c]) => n + c, 0);
  if (other) counts.push({ size: "Other", count: other });
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

/** One movement of money collected outside Razorpay (see getDirectCollections). */
export interface DirectPayment {
  /** Unique across both sources: `reg:<registration id>` or `adj:<adjustment id>`. */
  key: string;
  kind: "manual" | "bulk_import" | "category_change";
  registrationId: string;
  registrationCode: string | null;
  fullName: string;
  /** The registration's current category. */
  category: string | null;
  /** Category changes only: the move this difference was settled for. */
  fromCategory: string | null;
  toCategory: string | null;
  /** upi / cash / bank_transfer / other (null for bulk import or when not recorded). */
  mode: string | null;
  reference: string | null;
  note: string | null;
  pocName: string | null;
  /** Admin email that recorded it: manual_paid_by / adjustment created_by. Bulk import stores none. */
  recordedBy: string | null;
  /** When it was recorded: manual_paid_at (manual), created_at (bulk import / adjustment). */
  at: string;
  /** ₹; negative for a category-change refund. */
  amount: number;
}

export interface DirectCollections {
  /** Every direct payment, newest first. Sums exactly to payment_totals' direct amount. */
  payments: DirectPayment[];
  /**
   * Razorpay-paid registrations that carry a POC name. poc_totals (the dashboard's
   * By Group POC table) counts these too, although the money is not "collected directly".
   */
  razorpayPocTagged: { pocName: string; count: number; amount: number }[];
  /** First load error, if any (the lists are then incomplete). */
  error: string | null;
}

type PageResult = { data: unknown[] | null; error: { message: string } | null };

/**
 * Reads every row of a query, 1000 at a time (PostgREST's response cap). Advances by
 * the rows actually returned and stops on an empty page, so a lower server cap can't
 * silently truncate the result. `build` must apply a stable, unique ordering.
 */
async function fetchAllRows<T>(build: (from: number, to: number) => PromiseLike<PageResult>) {
  const rows: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await build(from, from + 999);
    if (error) return { rows, error: error.message };
    if (!data || data.length === 0) return { rows, error: null };
    rows.push(...(data as T[]));
    from += data.length;
  }
}

type DirectRegistrationRow = {
  id: string;
  registration_code: string | null;
  full_name: string;
  amount_inr: number | string;
  payment_method: "manual" | "bulk_import";
  manual_payment_mode: string | null;
  manual_payment_ref: string | null;
  manual_payment_note: string | null;
  manual_paid_by: string | null;
  manual_paid_at: string | null;
  poc_name: string | null;
  created_at: string;
  ticket_categories: { name: string } | null;
};

type AdjustmentWithRegistrationRow = {
  id: string;
  registration_id: string;
  from_category_name: string | null;
  to_category_name: string | null;
  amount_inr: number | string;
  mode: string | null;
  reference: string | null;
  note: string | null;
  poc_name: string | null;
  created_by: string | null;
  created_at: string;
  registrations: {
    registration_code: string | null;
    full_name: string;
    ticket_categories: { name: string } | null;
  } | null;
};

/**
 * Row-level detail behind payment_totals' "direct" figure (0019 / 0024): every paid
 * manual-override and bulk-import registration, plus every category-change adjustment
 * on a registration that is currently paid. Same filters as the RPC, so the amounts
 * add up to getPaymentTotals().direct.amount. Paged past PostgREST's 1000-row cap.
 */
export async function getDirectCollections(eventId: string): Promise<DirectCollections> {
  const supabase = createServiceClient();

  const [registrations, adjustments, razorpayTagged] = await Promise.all([
    fetchAllRows<DirectRegistrationRow>((from, to) =>
      supabase
        .from("registrations")
        .select(
          "id, registration_code, full_name, amount_inr, payment_method, manual_payment_mode, manual_payment_ref, manual_payment_note, manual_paid_by, manual_paid_at, poc_name, created_at, ticket_categories(name)"
        )
        .eq("event_id", eventId)
        .eq("payment_status", "paid")
        .neq("payment_method", "razorpay")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    // !inner + the payment_status filter = payment_totals' `join registrations ... status = 'paid'`.
    fetchAllRows<AdjustmentWithRegistrationRow>((from, to) =>
      supabase
        .from("registration_adjustments")
        .select(
          "id, registration_id, from_category_name, to_category_name, amount_inr, mode, reference, note, poc_name, created_by, created_at, registrations!inner(registration_code, full_name, payment_status, ticket_categories(name))"
        )
        .eq("event_id", eventId)
        .eq("registrations.payment_status", "paid")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<{ id: string; poc_name: string; amount_inr: number | string }>((from, to) =>
      supabase
        .from("registrations")
        .select("id, poc_name, amount_inr")
        .eq("event_id", eventId)
        .eq("payment_status", "paid")
        .eq("payment_method", "razorpay")
        .not("poc_name", "is", null)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);

  const error = registrations.error ?? adjustments.error ?? razorpayTagged.error;
  if (error) console.error("getDirectCollections failed", error);

  const payments: DirectPayment[] = [
    ...registrations.rows.map(
      (r): DirectPayment => ({
        key: `reg:${r.id}`,
        kind: r.payment_method === "manual" ? "manual" : "bulk_import",
        registrationId: r.id,
        registrationCode: r.registration_code,
        fullName: r.full_name,
        category: r.ticket_categories?.name ?? null,
        fromCategory: null,
        toCategory: null,
        mode: r.manual_payment_mode,
        reference: r.manual_payment_ref,
        note: r.manual_payment_note,
        pocName: r.poc_name,
        recordedBy: r.manual_paid_by,
        at: (r.payment_method === "manual" && r.manual_paid_at) || r.created_at,
        amount: Number(r.amount_inr),
      })
    ),
    ...adjustments.rows.map(
      (a): DirectPayment => ({
        key: `adj:${a.id}`,
        kind: "category_change",
        registrationId: a.registration_id,
        registrationCode: a.registrations?.registration_code ?? null,
        fullName: a.registrations?.full_name ?? "—",
        category: a.registrations?.ticket_categories?.name ?? null,
        fromCategory: a.from_category_name,
        toCategory: a.to_category_name,
        mode: a.mode,
        reference: a.reference,
        note: a.note,
        pocName: a.poc_name,
        recordedBy: a.created_by,
        at: a.created_at,
        amount: Number(a.amount_inr),
      })
    ),
  ].sort((x, y) => Date.parse(y.at) - Date.parse(x.at) || x.key.localeCompare(y.key));

  const tagged = new Map<string, { pocName: string; count: number; paise: number }>();
  for (const r of razorpayTagged.rows) {
    const t = tagged.get(r.poc_name) ?? { pocName: r.poc_name, count: 0, paise: 0 };
    t.count += 1;
    t.paise += Math.round(Number(r.amount_inr) * 100);
    tagged.set(r.poc_name, t);
  }

  return {
    payments,
    razorpayPocTagged: [...tagged.values()].map((t) => ({ pocName: t.pocName, count: t.count, amount: t.paise / 100 })),
    error,
  };
}

/** "direct" = anything not paid through Razorpay. */
export const PAYMENT_METHOD_FILTERS = ["razorpay", "direct", "manual", "bulk_import"] as const;

export async function listRegistrations(params: {
  eventId: string;
  search?: string;
  searchField?: SearchField;
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
  const searchFilter = await buildRegistrationSearchFilter(
    supabase,
    params.eventId,
    params.search,
    params.searchField
  );
  if (searchFilter) query = query.or(searchFilter);

  const { data, count, error } = await query;
  if (error) {
    console.error("listRegistrations failed", error);
    return { rows: [] as RegistrationRow[], count: 0, page, pageSize };
  }

  const rows = (data ?? []) as unknown as Omit<RegistrationRow, "adjustments">[];
  const adjustments = await listAdjustments(rows.map((r) => r.id));
  return {
    rows: rows.map((r) => ({ ...r, adjustments: adjustments.get(r.id) ?? [] })),
    count: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Category-change adjustments for the given registrations, oldest first.
 * Fetched separately rather than embedded so the listing keeps working
 * (just without adjustments) if migration 0024 hasn't been applied yet.
 */
async function listAdjustments(registrationIds: string[]) {
  const byRegistration = new Map<string, RegistrationAdjustment[]>();
  if (registrationIds.length === 0) return byRegistration;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("registration_adjustments")
    .select(ADJUSTMENT_COLUMNS)
    .in("registration_id", registrationIds)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listAdjustments failed", error);
    return byRegistration;
  }
  for (const a of (data ?? []) as RegistrationAdjustment[]) {
    const list = byRegistration.get(a.registration_id) ?? [];
    list.push({ ...a, price_diff_inr: Number(a.price_diff_inr), amount_inr: Number(a.amount_inr) });
    byRegistration.set(a.registration_id, list);
  }
  return byRegistration;
}
