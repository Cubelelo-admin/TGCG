"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GENDERS, TSHIRT_SIZES } from "@/lib/registration-schema";
import type { TicketCategory } from "@/lib/types";
import { MANUAL_PAYMENT_MODE_LABELS, MANUAL_PAYMENT_MODES, type ManualPaymentMode } from "@/lib/manual-payment";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";
// Native <option> ignores the <select>'s own dark background/text classes
// and falls back to the browser/OS default (white bg, black text) — style
// each option explicitly so the open dropdown matches the dark admin theme.
const optionClass = "bg-neutral-900 text-neutral-50";

export type EditableRegistration = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  city: string | null;
  tshirt_size: string | null;
  bib_number: string | null;
  checked_in: boolean;
  poc_name?: string | null;
  payment_status?: string;
  ticket_category_id: string;
  ticket_categories: { name: string; group: string; hidden_from_picker: boolean } | null;
};

export default function EditRegistrationButton({
  registration,
  categories,
}: {
  registration: EditableRegistration;
  categories: TicketCategory[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Child Runner has no phone/gender/city/t-shirt of its own (never
  // collected — see 0014_child_runner.sql) and its category is fixed: it's
  // the only category with hidden_from_picker, so it never appears as a
  // switch target either. Every other category is a valid target, across
  // competitive and non-competitive (0024).
  const isChildRunner = registration.ticket_categories?.hidden_from_picker ?? false;
  const switchableCategories = categories.filter((c) => !c.hidden_from_picker);
  const categoryGroups = (["competitive", "non_competitive"] as const)
    .map((group) => ({ group, options: switchableCategories.filter((c) => c.group === group) }))
    .filter((g) => g.options.length > 0);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => formFrom(registration));
  const [adj, setAdj] = useState(() => emptyAdjustment(registration.poc_name));

  // The listing only carries the basics; KYC/DOB/emergency contact etc. are
  // fetched on open so they aren't shipped to the page for every row.
  async function openDialog() {
    setOpen(true);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load registration");
      const full = body.registration as FullRegistration;
      setForm(formFrom(full));
      setAdj(emptyAdjustment(full.poc_name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load registration");
    } finally {
      setLoading(false);
    }
  }

  const selectedCategory = categories.find((c) => c.id === form.ticketCategoryId);
  const originalCategory = categories.find((c) => c.id === registration.ticket_category_id);
  const categoryChanged = form.ticketCategoryId !== registration.ticket_category_id;
  const isPaid = registration.payment_status === "paid";
  // Display only — the server recomputes the difference from the catalog.
  const priceDiff =
    selectedCategory && originalCategory
      ? Number(selectedCategory.price_inr) - Number(originalCategory.price_inr)
      : null;
  const needsSettlement = !isChildRunner && categoryChanged && isPaid && priceDiff !== 0;
  const isRefund = priceDiff !== null && priceDiff < 0;
  const adjNeedsRef = adj.mode === "upi" || adj.mode === "bank_transfer";
  const adjAmount = Number(adj.amount);
  const settlementValid =
    !needsSettlement ||
    (adj.amount !== "" &&
      adjAmount >= 0 &&
      adj.poc.trim() !== "" &&
      (!adjNeedsRef || adj.reference.trim() !== "") &&
      adj.confirmed);

  function changeCategory(id: string) {
    setForm((f) => ({ ...f, ticketCategoryId: id }));
    const next = categories.find((c) => c.id === id);
    const diff = next && originalCategory ? Number(next.price_inr) - Number(originalCategory.price_inr) : 0;
    setAdj((a) => ({ ...a, amount: String(Math.abs(diff)), confirmed: false }));
  }
  const showKyc =
    !isChildRunner &&
    (selectedCategory?.requires_kyc ||
      Boolean(form.aadharNumber || form.bankNameLocation || form.bankAccountNumber || form.bankIfsc || form.panNumber));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      fullName: form.fullName,
      email: form.email,
      bibNumber: form.bibNumber,
      checkedIn: form.checkedIn,
      pocName: form.pocName,
    };
    if (!isChildRunner) {
      body.phone = form.phone;
      body.gender = form.gender;
      body.city = form.city;
      body.tshirtSize = form.tshirtSize;
      body.dateOfBirth = form.dateOfBirth;
      body.emergencyPhone = form.emergencyPhone;
      body.organization = form.organization;
      body.runningCommunity = form.runningCommunity;
      body.aadharNumber = form.aadharNumber;
      body.bankNameLocation = form.bankNameLocation;
      body.bankAccountNumber = form.bankAccountNumber;
      body.bankIfsc = form.bankIfsc;
      body.panNumber = form.panNumber;
      body.acceptedTerms = form.acceptedTerms;
      if (categoryChanged) {
        body.ticketCategoryId = form.ticketCategoryId;
        if (isPaid) {
          body.categoryAdjustment = {
            // Entered as a positive number; the sign says which way the money moved.
            amount: needsSettlement ? (isRefund ? -adjAmount : adjAmount) : 0,
            mode: adj.mode,
            reference: adj.reference,
            note: adj.note,
            pocName: adj.poc,
          };
        }
      }
    }

    const res = await fetch(`/api/admin/registrations/${registration.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "Update failed");
      setSaving(false);
      return;
    }

    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label="Edit registration"
        title="Edit registration"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-neutral-300 hover:border-white/40 hover:text-neutral-50"
      >
        <PencilIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={onSubmit}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-5 text-neutral-50 sm:p-6"
          >
            <h2 className="text-lg font-bold">Edit registration</h2>
            {loading && <p className="mt-2 text-xs text-neutral-400">Loading full record…</p>}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <Field label="Full name">
                <input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Not collected — optional"
                  className={inputClass}
                />
              </Field>
              <Field label="Group POC (collects the money)">
                <input
                  value={form.pocName}
                  onChange={(e) => setForm((f) => ({ ...f, pocName: e.target.value }))}
                  placeholder="Only for bulk/offline registrations — optional"
                  maxLength={120}
                  className={inputClass}
                />
              </Field>

              <Field label="Category">
                {isChildRunner ? (
                  <input
                    disabled
                    value={registration.ticket_categories?.name ?? "Child Runner"}
                    className={`${inputClass} opacity-60`}
                  />
                ) : (
                  <select
                    value={form.ticketCategoryId}
                    onChange={(e) => changeCategory(e.target.value)}
                    className={inputClass}
                  >
                    {!originalCategory && (
                      <option value={registration.ticket_category_id} className={optionClass}>
                        {registration.ticket_categories?.name ?? "Current category"} (inactive)
                      </option>
                    )}
                    {categoryGroups.map(({ group, options }) => (
                      <optgroup
                        key={group}
                        label={group === "competitive" ? "Competitive" : "Non-competitive"}
                        className={optionClass}
                      >
                        {options.map((c) => (
                          <option key={c.id} value={c.id} className={optionClass}>
                            {c.name} — ₹{Number(c.price_inr).toLocaleString("en-IN")}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </Field>

              {!isChildRunner && categoryChanged && (
                <CategoryChangePanel
                  from={originalCategory}
                  to={selectedCategory}
                  isPaid={isPaid}
                  priceDiff={priceDiff}
                  needsSettlement={needsSettlement}
                  isRefund={isRefund}
                  adj={adj}
                  setAdj={setAdj}
                  needsRef={adjNeedsRef}
                />
              )}

              {!isChildRunner && (
                <>
                  <Field label="Phone">
                    <input
                      required
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Gender">
                      <select
                        value={form.gender}
                        onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                        className={inputClass}
                      >
                        {GENDERS.map((g) => (
                          <option key={g} value={g} className={optionClass}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="T-shirt size">
                      <select
                        value={form.tshirtSize}
                        onChange={(e) => setForm((f) => ({ ...f, tshirtSize: e.target.value }))}
                        className={inputClass}
                      >
                        {TSHIRT_SIZES.map((s) => (
                          <option key={s} value={s} className={optionClass}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="City">
                    <input
                      required
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Date of birth">
                      <input
                        type="date"
                        value={form.dateOfBirth}
                        onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Emergency phone">
                      <input
                        value={form.emergencyPhone}
                        onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Organization">
                      <input
                        value={form.organization}
                        onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                        placeholder="Optional"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Running community">
                      <input
                        value={form.runningCommunity}
                        onChange={(e) => setForm((f) => ({ ...f, runningCommunity: e.target.value }))}
                        placeholder="Optional"
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  {showKyc && (
                    <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-white/10 p-3">
                      <legend className="px-1 text-xs text-neutral-400">
                        Prize-money KYC{selectedCategory?.requires_kyc ? " (required for this category)" : ""}
                      </legend>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Aadhar number">
                          <input
                            value={form.aadharNumber}
                            onChange={(e) => setForm((f) => ({ ...f, aadharNumber: e.target.value }))}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="PAN (optional)">
                          <input
                            value={form.panNumber}
                            onChange={(e) => setForm((f) => ({ ...f, panNumber: e.target.value }))}
                            className={inputClass}
                          />
                        </Field>
                      </div>
                      <Field label="Bank name & location">
                        <input
                          value={form.bankNameLocation}
                          onChange={(e) => setForm((f) => ({ ...f, bankNameLocation: e.target.value }))}
                          className={inputClass}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Account number">
                          <input
                            value={form.bankAccountNumber}
                            onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="IFSC">
                          <input
                            value={form.bankIfsc}
                            onChange={(e) => setForm((f) => ({ ...f, bankIfsc: e.target.value }))}
                            className={inputClass}
                          />
                        </Field>
                      </div>
                    </fieldset>
                  )}
                </>
              )}

              <Field label="BIB number">
                <input
                  value={form.bibNumber}
                  onChange={(e) => setForm((f) => ({ ...f, bibNumber: e.target.value }))}
                  placeholder="5 digits, or SUPERHERO — auto-assigned on payment"
                  className={inputClass}
                />
              </Field>
              {!isChildRunner && form.ticketCategoryId !== registration.ticket_category_id && (
                <p className="text-xs text-amber-400">
                  Changing category to a different distance will re-issue a new BIB from that
                  distance&apos;s pool — whatever you typed above will be replaced.
                </p>
              )}
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={form.checkedIn}
                  onChange={(e) => setForm((f) => ({ ...f, checkedIn: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/20 bg-white/[0.04]"
                />
                Checked in
              </label>
              {!isChildRunner && (
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={form.acceptedTerms}
                    onChange={(e) => setForm((f) => ({ ...f, acceptedTerms: e.target.checked }))}
                    className="h-4 w-4 rounded border-white/20 bg-white/[0.04]"
                  />
                  Accepted waiver &amp; rules
                </label>
              )}
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium hover:border-white/40 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || loading || !settlementValid}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

type AdjustmentForm = {
  amount: string;
  mode: ManualPaymentMode;
  reference: string;
  note: string;
  poc: string;
  confirmed: boolean;
};

function emptyAdjustment(pocName?: string | null): AdjustmentForm {
  return { amount: "", mode: "upi", reference: "", note: "", poc: pocName ?? "", confirmed: false };
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Category change summary + offline settlement of the price difference
 * (same idea as "Mark paid": money taken outside Razorpay, with the POC who
 * handled it recorded against the registration).
 */
function CategoryChangePanel({
  from,
  to,
  isPaid,
  priceDiff,
  needsSettlement,
  isRefund,
  adj,
  setAdj,
  needsRef,
}: {
  from: TicketCategory | undefined;
  to: TicketCategory | undefined;
  isPaid: boolean;
  priceDiff: number | null;
  needsSettlement: boolean;
  isRefund: boolean;
  adj: AdjustmentForm;
  setAdj: React.Dispatch<React.SetStateAction<AdjustmentForm>>;
  needsRef: boolean;
}) {
  const crossGroup = from && to && from.group !== to.group ? { from, to } : null;
  const amount = Number(adj.amount) || 0;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-sky-400/30 bg-sky-500/[0.06] p-3 text-sm">
      <div>
        <p className="break-words font-medium text-sky-200">
          {from?.name ?? "Current category"} → {to?.name ?? "New category"}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {from && to && (
            <>
              {rupees(Number(from.price_inr))} → {rupees(Number(to.price_inr))} ·{" "}
            </>
          )}
          {priceDiff === null
            ? "difference computed from the catalog on save"
            : priceDiff === 0
              ? "same price"
              : priceDiff > 0
                ? `runner owes ${rupees(priceDiff)}`
                : `runner is owed ${rupees(-priceDiff)}`}
        </p>
        {crossGroup && (
          <p className="mt-1 text-xs text-amber-300">
            Switching {crossGroup.from.group === "competitive" ? "competitive → non-competitive" : "non-competitive → competitive"}.
            {crossGroup.to.requires_kyc && " Prize-money KYC (Aadhar + bank details) is required below."}
          </p>
        )}
      </div>

      {!isPaid && (
        <p className="text-xs text-neutral-400">
          Not paid yet — no adjustment needed. The new category&apos;s price applies when the booking is paid
          (or marked paid).
        </p>
      )}

      {isPaid && !needsSettlement && (
        <p className="text-xs text-neutral-400">No price difference — nothing to collect or refund.</p>
      )}

      {needsSettlement && (
        <>
          <p className="text-xs text-neutral-400">
            Paid registration: settle the difference offline and record it here. It&apos;s counted under
            &ldquo;Collected directly&rdquo; and against the POC below.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={isRefund ? "Amount refunded (₹)" : "Amount collected (₹)"}>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={adj.amount}
                onChange={(e) => setAdj((a) => ({ ...a, amount: e.target.value, confirmed: false }))}
                className={inputClass}
              />
            </Field>
            <Field label="POC (handled the money)">
              <input
                required
                value={adj.poc}
                onChange={(e) => setAdj((a) => ({ ...a, poc: e.target.value }))}
                maxLength={120}
                placeholder="Required"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mode">
              <select
                value={adj.mode}
                onChange={(e) => setAdj((a) => ({ ...a, mode: e.target.value as ManualPaymentMode }))}
                className={inputClass}
              >
                {MANUAL_PAYMENT_MODES.map((m) => (
                  <option key={m} value={m} className={optionClass}>
                    {MANUAL_PAYMENT_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`UPI txn ID / UTR ${needsRef ? "(required)" : "(optional)"}`}>
              <input
                required={needsRef}
                value={adj.reference}
                onChange={(e) => setAdj((a) => ({ ...a, reference: e.target.value }))}
                maxLength={120}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Note (optional)">
            <input
              value={adj.note}
              onChange={(e) => setAdj((a) => ({ ...a, note: e.target.value }))}
              maxLength={500}
              placeholder="e.g. Upgrade requested on call; difference collected by Ravi"
              className={inputClass}
            />
          </Field>
          {priceDiff !== null && amount !== Math.abs(priceDiff) && (
            <p className="text-xs text-amber-400">
              Differs from the price difference of {rupees(Math.abs(priceDiff))} — add a note saying why.
            </p>
          )}
          <label className="flex items-start gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={adj.confirmed}
              onChange={(e) => setAdj((a) => ({ ...a, confirmed: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/[0.04]"
            />
            I&apos;ve verified {rupees(amount)} was {isRefund ? "refunded to the runner" : "received"} offline.
          </label>
        </>
      )}
    </div>
  );
}

type FullRegistration = EditableRegistration & {
  date_of_birth?: string | null;
  emergency_phone?: string | null;
  organization?: string | null;
  running_community?: string | null;
  aadhar_number?: string | null;
  bank_name_location?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  pan_number?: string | null;
  accepted_waiver?: boolean;
  accepted_rules?: boolean;
};

function formFrom(r: FullRegistration) {
  return {
    fullName: r.full_name,
    email: r.email ?? "",
    phone: r.phone ?? "",
    gender: r.gender ?? GENDERS[0],
    city: r.city ?? "",
    tshirtSize: r.tshirt_size ?? TSHIRT_SIZES[0],
    bibNumber: r.bib_number ?? "",
    checkedIn: r.checked_in,
    pocName: r.poc_name ?? "",
    ticketCategoryId: r.ticket_category_id,
    dateOfBirth: r.date_of_birth ?? "",
    emergencyPhone: r.emergency_phone ?? "",
    organization: r.organization ?? "",
    runningCommunity: r.running_community ?? "",
    aadharNumber: r.aadhar_number ?? "",
    bankNameLocation: r.bank_name_location ?? "",
    bankAccountNumber: r.bank_account_number ?? "",
    bankIfsc: r.bank_ifsc ?? "",
    panNumber: r.pan_number ?? "",
    acceptedTerms: Boolean(r.accepted_waiver && r.accepted_rules),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
