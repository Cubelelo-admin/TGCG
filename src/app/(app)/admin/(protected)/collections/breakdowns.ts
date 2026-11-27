import type { DirectCollections, DirectPayment, PocTotal } from "@/lib/admin-data";
import { MANUAL_PAYMENT_MODE_LABELS, type ManualPaymentMode } from "@/lib/manual-payment";

/*
 * Pure aggregation for /admin/collections. Every breakdown is built from the same list of
 * direct payments and gives every payment exactly one bucket, so each breakdown's total is
 * that list's total. Money is summed in paise (integers) so it matches Postgres' exact
 * numeric sums to the rupee and paisa.
 */

/** ₹ with Indian grouping; refunds as "−₹500". */
export function inr(n: number) {
  const abs = Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return n < 0 ? `−₹${abs}` : `₹${abs}`;
}

export const toPaise = (n: number) => Math.round(n * 100);
const count = (n: number) => n.toLocaleString("en-IN");
const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? "" : "s"}`;

export interface BreakdownColumn {
  header: string;
  align?: "left" | "right";
}

/** One bucket, pre-formatted so it can cross into a client component. */
export interface BreakdownRow {
  key: string;
  label: string;
  caption?: string;
  href?: string;
  /** Table cells after the label column (the first one is the bucket total, so it stays visible in a narrow card). */
  cells: string[];
  /** Bucket total in ₹ (bar length) and its text. */
  amount: number;
  amountText: string;
}

export interface Breakdown {
  columns: BreakdownColumn[];
  rows: BreakdownRow[];
  /** Cells of the "Total" row (same shape as a row's cells). */
  totalCells: string[];
}

type Bucket = {
  key: string;
  label: string;
  /** Kept at the end regardless of amount (e.g. "Bulk import", "No POC"). */
  last?: boolean;
  href?: string;
  n: number;
  manual: number;
  bulk: number;
  adjustment: number;
  adjustmentCount: number;
  regIds: Set<string>;
  adjustedRegIds: Set<string>;
};

function bucketer() {
  const map = new Map<string, Bucket>();
  return {
    add(key: string, label: string, p: DirectPayment, extra: { last?: boolean; href?: string } = {}) {
      const b =
        map.get(key) ??
        ({
          key,
          label,
          n: 0,
          manual: 0,
          bulk: 0,
          adjustment: 0,
          adjustmentCount: 0,
          regIds: new Set(),
          adjustedRegIds: new Set(),
          ...extra,
        } satisfies Bucket);
      const paise = toPaise(p.amount);
      b.n += 1;
      if (p.kind === "manual") b.manual += paise;
      else if (p.kind === "bulk_import") b.bulk += paise;
      else {
        b.adjustment += paise;
        b.adjustmentCount += 1;
        b.adjustedRegIds.add(p.registrationId);
      }
      if (p.kind !== "category_change") b.regIds.add(p.registrationId);
      map.set(key, b);
    },
    /** Largest total first; "last" buckets after the rest. */
    list() {
      const total = (b: Bucket) => b.manual + b.bulk + b.adjustment;
      return [...map.values()].sort(
        (a, b) => Number(a.last ?? false) - Number(b.last ?? false) || total(b) - total(a) || a.label.localeCompare(b.label)
      );
    },
  };
}

const sumPaise = (bs: Bucket[], pick: (b: Bucket) => number) => bs.reduce((s, b) => s + pick(b), 0);
const bucketTotal = (b: Bucket) => b.manual + b.bulk + b.adjustment;

/** `cells` are the columns after the bucket total; the total is put first here. */
function row(b: Bucket, cells: string[], caption: string): BreakdownRow {
  const paise = bucketTotal(b);
  // A bucket can net negative when a category-change refund is its only entry (empty bar).
  const fullCaption = paise < 0 ? `${caption} · net refund` : caption;
  return {
    key: b.key,
    label: b.label,
    caption: fullCaption,
    href: b.href,
    cells: [inr(paise / 100), ...cells],
    amount: paise / 100,
    amountText: inr(paise / 100),
  };
}

function registrationsHref(params: Record<string, string>) {
  return `/admin/registrations?${new URLSearchParams(params).toString()}`;
}

/** Payment count, manual, bulk and category-change cells (after the total). */
const kindCells = (x: Bucket) => [count(x.n), inr(x.manual / 100), inr(x.bulk / 100), inr(x.adjustment / 100)];

const modeLabel = (mode: string | null) =>
  mode ? (MANUAL_PAYMENT_MODE_LABELS[mode as ManualPaymentMode] ?? mode) : "Mode not recorded";

/** Manual overrides and category changes by mode (UPI, cash, ...); bulk import has no mode. */
export function byMode(payments: DirectPayment[]): Breakdown {
  const b = bucketer();
  for (const p of payments) {
    if (p.kind === "bulk_import") b.add("bulk", "Bulk import", p, { last: true });
    else b.add(p.mode ?? "none", modeLabel(p.mode), p, { last: !p.mode });
  }
  const list = b.list();
  return {
    columns: [
      { header: "Mode" },
      { header: "Total", align: "right" },
      { header: "Payments", align: "right" },
      { header: "Manual override", align: "right" },
      { header: "Bulk import", align: "right" },
      { header: "Category changes", align: "right" },
    ],
    rows: list.map((x) => row(x, kindCells(x), `${plural(x.n, "payment")}${x.key === "bulk" ? " · no mode stored" : ""}`)),
    totalCells: totals(list),
  };
}

/** Who recorded it in the admin: manual_paid_by / adjustment created_by. Bulk import stores no recorder. */
export function byRecorder(payments: DirectPayment[]): Breakdown {
  const b = bucketer();
  for (const p of payments) {
    if (p.kind === "bulk_import") b.add("bulk", "Bulk import", p, { last: true });
    // A search for the admin's email among paid registrations (payment fields + category changes), not an exact
    // reproduction of the row: the search also matches the email in refs/notes.
    else if (p.recordedBy)
      b.add(`by:${p.recordedBy}`, p.recordedBy, p, { href: registrationsHref({ q: p.recordedBy, field: "payment", status: "paid" }) });
    else b.add("none", "Not recorded", p, { last: true });
  }
  const list = b.list();
  return {
    columns: [
      { header: "Recorded by" },
      { header: "Total", align: "right" },
      { header: "Payments", align: "right" },
      { header: "Manual override", align: "right" },
      { header: "Bulk import", align: "right" },
      { header: "Category changes", align: "right" },
    ],
    rows: list.map((x) => row(x, kindCells(x), `${plural(x.n, "payment")}${x.key === "bulk" ? " · recorder not stored" : ""}`)),
    totalCells: totals(list),
  };
}

/** The registration's current category; category-change differences count under the category moved to. */
export function byCategory(payments: DirectPayment[]): Breakdown {
  // Category changes can sit on a registration first paid through Razorpay. For a category with any
  // such change, the link can't add method=direct, or the list would drop that registration.
  const directRegIds = new Set(payments.filter((p) => p.kind !== "category_change").map((p) => p.registrationId));
  const hasRazorpayChange = new Set(
    payments
      .filter((p) => p.kind === "category_change" && p.category && !directRegIds.has(p.registrationId))
      .map((p) => p.category as string)
  );
  const b = bucketer();
  for (const p of payments) {
    const name = p.category ?? "Unknown category";
    b.add(`cat:${name}`, name, p, {
      last: !p.category,
      href: p.category
        ? registrationsHref({
            q: p.category,
            field: "category",
            ...(hasRazorpayChange.has(p.category) ? {} : { method: "direct" }),
            status: "paid",
          })
        : undefined,
    });
  }
  const list = b.list();
  return {
    columns: [
      { header: "Category" },
      { header: "Total", align: "right" },
      { header: "Paid regs", align: "right" },
      { header: "Manual override", align: "right" },
      { header: "Bulk import", align: "right" },
      { header: "Category changes", align: "right" },
    ],
    rows: list.map((x) =>
      row(
        x,
        [count(x.regIds.size), inr(x.manual / 100), inr(x.bulk / 100), inr(x.adjustment / 100)],
        `${count(x.regIds.size)} paid${x.adjustmentCount ? ` · ${plural(x.adjustmentCount, "category change")}` : ""}`
      )
    ),
    totalCells: totals(list, (bs) => count(bs.reduce((s, x) => s + x.regIds.size, 0))),
  };
}

export interface PocBreakdown extends Breakdown {
  /** Razorpay-paid registrations tagged with a POC (in the dashboard table, not in "collected directly"). */
  razorpayTagged: { pocName: string; count: number; amount: number }[];
  /** POCs whose figures here don't match poc_totals (should be empty). */
  mismatches: string[];
}

/**
 * Per POC: bulk imports, manual overrides that carry a POC, and category-change
 * differences, counted the way poc_totals counts. Every POC is cross-checked against
 * poc_totals (the dashboard table), allowing for Razorpay-paid registrations tagged with a
 * POC, which poc_totals includes but which are not direct money. Direct money with no POC gets its own bucket, so the rows still add
 * up to the direct total.
 */
export function byPoc(data: DirectCollections, pocTotals: PocTotal[]): PocBreakdown {
  const b = bucketer();
  for (const p of data.payments) {
    // != null, not truthiness: poc_totals groups any non-null name, blank included.
    if (p.pocName != null)
      b.add(`poc:${p.pocName}`, p.pocName || "(blank POC)", p, { href: registrationsHref({ q: p.pocName, field: "poc" }) });
    else b.add("none", "No POC recorded", p, { last: true });
  }
  const list = b.list();
  const tagged = new Map(data.razorpayPocTagged.map((t) => [t.pocName, t]));
  const pocOf = (x: Bucket) => x.key.slice("poc:".length);

  // Counted the way poc_totals counts: paid registrations + distinct registrations with an
  // adjustment under the POC. Shown without Razorpay-tagged registrations (their money isn't here).
  const directCount = (x: Bucket) => x.regIds.size + x.adjustedRegIds.size;
  const dashboardCount = (x: Bucket) => directCount(x) + (tagged.get(pocOf(x))?.count ?? 0);

  // Cross-check against the RPC the dashboard uses (same filters, see 0024's poc_totals).
  const mismatches: string[] = [];
  const mine = new Map<string, { count: number; paise: number }>();
  for (const x of list) {
    if (x.key === "none") continue;
    mine.set(pocOf(x), { count: dashboardCount(x), paise: bucketTotal(x) + toPaise(tagged.get(pocOf(x))?.amount ?? 0) });
  }
  for (const t of data.razorpayPocTagged) {
    if (!mine.has(t.pocName)) mine.set(t.pocName, { count: t.count, paise: toPaise(t.amount) });
  }
  const seen = new Set<string>();
  for (const p of pocTotals) {
    seen.add(p.pocName);
    const m = mine.get(p.pocName);
    if (!m || m.count !== p.count || m.paise !== toPaise(p.amount)) mismatches.push(p.pocName);
  }
  for (const name of mine.keys()) if (!seen.has(name)) mismatches.push(name);

  return {
    columns: [
      { header: "POC" },
      { header: "Collected directly", align: "right" },
      // poc_totals' count: paid registrations + registrations with a category change (one runner can be both),
      // so it can exceed the paid-registration count in the KPI above.
      { header: "Regs + changes", align: "right" },
      { header: "Bulk import", align: "right" },
      { header: "Manual override", align: "right" },
      { header: "Category changes", align: "right" },
    ],
    rows: list.map((x) =>
      row(
        x,
        [count(directCount(x)), inr(x.bulk / 100), inr(x.manual / 100), inr(x.adjustment / 100)],
        `${plural(x.regIds.size, "paid reg")}${x.adjustedRegIds.size ? ` · ${plural(x.adjustedRegIds.size, "category change")}` : ""}`
      )
    ),
    totalCells: [
      inr(sumPaise(list, bucketTotal) / 100),
      count(list.reduce((s, x) => s + directCount(x), 0)),
      inr(sumPaise(list, (x) => x.bulk) / 100),
      inr(sumPaise(list, (x) => x.manual) / 100),
      inr(sumPaise(list, (x) => x.adjustment) / 100),
    ],
    razorpayTagged: data.razorpayPocTagged,
    mismatches,
  };
}

/** Standard total row: total, payments, manual, bulk, adjustments. */
function totals(list: Bucket[], first: (bs: Bucket[]) => string = (bs) => count(bs.reduce((s, x) => s + x.n, 0))) {
  return [
    inr(sumPaise(list, bucketTotal) / 100),
    first(list),
    inr(sumPaise(list, (x) => x.manual) / 100),
    inr(sumPaise(list, (x) => x.bulk) / 100),
    inr(sumPaise(list, (x) => x.adjustment) / 100),
  ];
}

/** Totals straight from the payment list, in paise. */
export function summarise(payments: DirectPayment[]) {
  const s = { total: 0, manual: 0, manualN: 0, bulk: 0, bulkN: 0, adjustment: 0, adjustmentN: 0, collected: 0, refunded: 0 };
  for (const p of payments) {
    const paise = toPaise(p.amount);
    s.total += paise;
    if (p.kind === "manual") {
      s.manual += paise;
      s.manualN += 1;
    } else if (p.kind === "bulk_import") {
      s.bulk += paise;
      s.bulkN += 1;
    } else {
      s.adjustment += paise;
      s.adjustmentN += 1;
      if (paise > 0) s.collected += paise;
      else s.refunded -= paise;
    }
  }
  return s;
}
