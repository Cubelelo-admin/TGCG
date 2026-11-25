"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GENDERS, TSHIRT_SIZES } from "@/lib/registration-schema";
import type { TicketCategory } from "@/lib/types";
import { MANUAL_PAYMENT_MODE_LABELS, MANUAL_PAYMENT_MODES, type ManualPaymentMode } from "@/lib/manual-payment";
import { Banner, Button, Checkbox, Drawer, FieldLabel, Icon, TextField, inputClass } from "@/components/ds";

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
  const formId = useId();
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
  // What the drawer showed when it opened/loaded, for the discard prompt only.
  const baselineRef = useRef<{ form: RegistrationForm; adj: AdjustmentForm } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // The listing only carries the basics; KYC/DOB/emergency contact etc. are
  // fetched on open so they aren't shipped to the page for every row.
  async function openDialog() {
    setOpen(true);
    setError(null);
    setLoading(true);
    baselineRef.current = { form, adj };
    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load registration");
      const full = body.registration as FullRegistration;
      const loadedForm = formFrom(full);
      const loadedAdj = emptyAdjustment(full.poc_name);
      baselineRef.current = { form: loadedForm, adj: loadedAdj };
      setForm(loadedForm);
      setAdj(loadedAdj);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load registration");
    } finally {
      setLoading(false);
    }
  }

  // Same as the old Cancel button: can't dismiss mid-save.
  function closeDialog() {
    if (saving) return;
    setOpen(false);
  }

  // The old dialog only closed from Cancel. The Drawer also closes on ✕, Esc and
  // overlay click (e.g. a text drag-select released over the overlay), so those
  // paths ask before throwing away edits. Cancel stays an immediate close.
  function dismissDialog() {
    if (saving) return;
    const base = baselineRef.current;
    const dirty = base !== null && (!sameValues(form, base.form) || !sameValues(adj, base.adj));
    if (dirty && !window.confirm("Discard your unsaved changes to this registration?")) return;
    setOpen(false);
  }

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

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
      <Button
        type="button"
        size="sm"
        onClick={openDialog}
        aria-label="Edit registration"
        title="Edit registration"
        className="w-7 px-0!"
      >
        <Icon name="pencil" size={14} />
      </Button>

      <Drawer
        open={open}
        title="Edit registration"
        onClose={dismissDialog}
        footer={
          <>
            <Button type="button" size="sm" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              size="sm"
              variant="dark"
              disabled={saving || loading || !settlementValid}
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={onSubmit}>
          {/* Top of the scroll area (and scrolled to) so a failed save is never below the fold. */}
          {error && (
            <div ref={errorRef} className="mb-4">
              <Banner tone="danger">{error}</Banner>
            </div>
          )}

          {loading &&<p className="mb-4 text-12 text-ink-muted">Loading full record…</p>}

          <div className="grid grid-cols-1 gap-4">
            <TextField
              label="Full name"
              required
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Not collected — optional"
            />
            <TextField
              label="Group POC (collects the money)"
              value={form.pocName}
              onChange={(e) => setForm((f) => ({ ...f, pocName: e.target.value }))}
              placeholder="Only for bulk/offline registrations — optional"
              maxLength={120}
            />

            <div className="min-w-0">
              <FieldLabel label="Category" htmlFor={`${formId}-category`} />
              {isChildRunner ? (
                <input
                  id={`${formId}-category`}
                  disabled
                  value={registration.ticket_categories?.name ?? "Child Runner"}
                  className={inputClass}
                />
              ) : (
                <select
                  id={`${formId}-category`}
                  value={form.ticketCategoryId}
                  onChange={(e) => changeCategory(e.target.value)}
                  className={inputClass}
                >
                  {!originalCategory && (
                    <option value={registration.ticket_category_id}>
                      {registration.ticket_categories?.name ?? "Current category"} (inactive)
                    </option>
                  )}
                  {categoryGroups.map(({ group, options }) => (
                    <optgroup key={group} label={group === "competitive" ? "Competitive" : "Non-competitive"}>
                      {options.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — ₹{Number(c.price_inr).toLocaleString("en-IN")}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

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
                idPrefix={formId}
              />
            )}

            {!isChildRunner && (
              <>
                <TextField
                  label="Phone"
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <NativeSelect
                    id={`${formId}-gender`}
                    label="Gender"
                    value={form.gender}
                    onChange={(v) => setForm((f) => ({ ...f, gender: v }))}
                    options={GENDERS.map((g) => ({ value: g, label: g }))}
                  />
                  <NativeSelect
                    id={`${formId}-tshirt`}
                    label="T-shirt size"
                    value={form.tshirtSize}
                    onChange={(v) => setForm((f) => ({ ...f, tshirtSize: v }))}
                    options={TSHIRT_SIZES.map((s) => ({ value: s, label: s }))}
                  />
                </div>
                <TextField
                  label="City"
                  required
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    label="Date of birth"
                    type="date"
                    className="min-w-0"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  />
                  <TextField
                    label="Emergency phone"
                    className="min-w-0"
                    value={form.emergencyPhone}
                    onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    label="Organization"
                    className="min-w-0"
                    value={form.organization}
                    onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                    placeholder="Optional"
                  />
                  <TextField
                    label="Running community"
                    className="min-w-0"
                    value={form.runningCommunity}
                    onChange={(e) => setForm((f) => ({ ...f, runningCommunity: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                {showKyc && (
                  <fieldset className="grid grid-cols-1 gap-4 rounded-8 border border-line-secondary p-4">
                    <legend className="px-1 text-12 font-medium text-ink-secondary">
                      Prize-money KYC{selectedCategory?.requires_kyc ? " (required for this category)" : ""}
                    </legend>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <TextField
                        label="Aadhar number"
                        className="min-w-0"
                        value={form.aadharNumber}
                        onChange={(e) => setForm((f) => ({ ...f, aadharNumber: e.target.value }))}
                      />
                      <TextField
                        label="PAN (optional)"
                        className="min-w-0"
                        value={form.panNumber}
                        onChange={(e) => setForm((f) => ({ ...f, panNumber: e.target.value }))}
                      />
                    </div>
                    <TextField
                      label="Bank name & location"
                      value={form.bankNameLocation}
                      onChange={(e) => setForm((f) => ({ ...f, bankNameLocation: e.target.value }))}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <TextField
                        label="Account number"
                        className="min-w-0"
                        value={form.bankAccountNumber}
                        onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
                      />
                      <TextField
                        label="IFSC"
                        className="min-w-0"
                        value={form.bankIfsc}
                        onChange={(e) => setForm((f) => ({ ...f, bankIfsc: e.target.value }))}
                      />
                    </div>
                  </fieldset>
                )}
              </>
            )}

            <TextField
              label="BIB number"
              value={form.bibNumber}
              onChange={(e) => setForm((f) => ({ ...f, bibNumber: e.target.value }))}
              placeholder="5 digits, or SUPERHERO — auto-assigned on payment"
            />
            {!isChildRunner && form.ticketCategoryId !== registration.ticket_category_id && (
              <p className="-mt-2 text-12 text-on-tint-orange">
                Changing category to a different distance will re-issue a new BIB from that
                distance&apos;s pool — whatever you typed above will be replaced.
              </p>
            )}
            <div className="flex flex-col gap-3">
              <Checkbox
                checked={form.checkedIn}
                onChange={(checked) => setForm((f) => ({ ...f, checkedIn: checked }))}
                label="Checked in"
              />
              {!isChildRunner && (
                <Checkbox
                  checked={form.acceptedTerms}
                  onChange={(checked) => setForm((f) => ({ ...f, acceptedTerms: checked }))}
                  label="Accepted waiver & rules"
                />
              )}
            </div>
          </div>
        </form>
      </Drawer>
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
  idPrefix,
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
  idPrefix: string;
}) {
  const crossGroup = from && to && from.group !== to.group ? { from, to } : null;
  const amount = Number(adj.amount) || 0;

  return (
    <div className="grid grid-cols-1 gap-4 rounded-12 border border-tint-blue bg-[#EFF8FF] p-4">
      <div>
        <p className="flex items-start gap-2 break-words text-14 font-medium text-ink">
          <Icon name="swap" size={16} className="mt-px shrink-0 text-link" />
          <span className="min-w-0">
            {from?.name ?? "Current category"} → {to?.name ?? "New category"}
          </span>
        </p>
        <p className="mt-1 text-12 text-ink-tertiary">
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
          <p className="mt-1 text-12 text-on-tint-orange">
            Switching {crossGroup.from.group === "competitive" ? "competitive → non-competitive" : "non-competitive → competitive"}.
            {crossGroup.to.requires_kyc && " Prize-money KYC (Aadhar + bank details) is required below."}
          </p>
        )}
      </div>

      {!isPaid && (
        <p className="text-12 text-ink-tertiary">
          Not paid yet — no adjustment needed. The new category&apos;s price applies when the booking is paid
          (or marked paid).
        </p>
      )}

      {isPaid && !needsSettlement && (
        <p className="text-12 text-ink-tertiary">No price difference — nothing to collect or refund.</p>
      )}

      {needsSettlement && (
        <>
          <p className="text-12 text-ink-tertiary">
            Paid registration: settle the difference offline and record it here. It&apos;s counted under
            &ldquo;Collected directly&rdquo; and against the POC below.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id={`${idPrefix}-adj-amount`}
              label={isRefund ? "Amount refunded (₹)" : "Amount collected (₹)"}
              className="min-w-0"
              type="number"
              min={0}
              step="0.01"
              required
              value={adj.amount}
              onChange={(e) => setAdj((a) => ({ ...a, amount: e.target.value, confirmed: false }))}
            />
            <TextField
              id={`${idPrefix}-adj-poc`}
              label="POC (handled the money)"
              className="min-w-0"
              required
              value={adj.poc}
              onChange={(e) => setAdj((a) => ({ ...a, poc: e.target.value }))}
              maxLength={120}
              placeholder="Required"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NativeSelect
              id={`${idPrefix}-adj-mode`}
              label="Mode"
              value={adj.mode}
              onChange={(v) => setAdj((a) => ({ ...a, mode: v as ManualPaymentMode }))}
              options={MANUAL_PAYMENT_MODES.map((m) => ({ value: m, label: MANUAL_PAYMENT_MODE_LABELS[m] }))}
            />
            <TextField
              id={`${idPrefix}-adj-ref`}
              label={`UPI txn ID / UTR ${needsRef ? "(required)" : "(optional)"}`}
              className="min-w-0"
              required={needsRef}
              value={adj.reference}
              onChange={(e) => setAdj((a) => ({ ...a, reference: e.target.value }))}
              maxLength={120}
            />
          </div>
          <TextField
            id={`${idPrefix}-adj-note`}
            label="Note (optional)"
            value={adj.note}
            onChange={(e) => setAdj((a) => ({ ...a, note: e.target.value }))}
            maxLength={500}
            placeholder="e.g. Upgrade requested on call; difference collected by Ravi"
          />
          {priceDiff !== null && amount !== Math.abs(priceDiff) && (
            <p className="text-12 text-on-tint-orange">
              Differs from the price difference of {rupees(Math.abs(priceDiff))} — add a note saying why.
            </p>
          )}
          <Checkbox
            checked={adj.confirmed}
            onChange={(checked) => setAdj((a) => ({ ...a, confirmed: checked }))}
            label={
              <>
                I&apos;ve verified {rupees(amount)} was {isRefund ? "refunded to the runner" : "received"} offline.
              </>
            }
          />
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

type RegistrationForm = ReturnType<typeof formFrom>;

/** Shallow equality for the flat form/adjustment objects. */
function sameValues<T extends object>(a: T, b: T) {
  return (Object.keys(a) as (keyof T)[]).every((k) => a[k] === b[k]);
}

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

/**
 * Native <select> in the Dock input style. Kept native (not the DS popover
 * Select) so it can't be clipped by the drawer's scroll area.
 */
function NativeSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-0">
      <FieldLabel label={label} htmlFor={id} />
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
