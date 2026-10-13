"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GENDERS, TSHIRT_SIZES } from "@/lib/registration-schema";
import type { TicketCategory } from "@/lib/types";

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
  // switch target either.
  const isChildRunner = registration.ticket_categories?.hidden_from_picker ?? false;
  const currentGroup = registration.ticket_categories?.group;
  const sameGroupCategories = categories.filter(
    (c) => !c.hidden_from_picker && c.group === currentGroup
  );

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => formFrom(registration));

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
      setForm(formFrom(body.registration as FullRegistration));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load registration");
    } finally {
      setLoading(false);
    }
  }

  const selectedCategory = categories.find((c) => c.id === form.ticketCategoryId);
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
      if (form.ticketCategoryId !== registration.ticket_category_id) {
        body.ticketCategoryId = form.ticketCategoryId;
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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-5 text-neutral-50 sm:p-6"
          >
            <h2 className="text-lg font-bold">Edit registration</h2>
            {loading && <p className="mt-2 text-xs text-neutral-400">Loading full record…</p>}

            <div className="mt-4 grid gap-3">
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
                    onChange={(e) => setForm((f) => ({ ...f, ticketCategoryId: e.target.value }))}
                    className={inputClass}
                  >
                    {sameGroupCategories.map((c) => (
                      <option key={c.id} value={c.id} className={optionClass}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

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
                    <fieldset className="grid gap-3 rounded-lg border border-white/10 p-3">
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
                disabled={saving || loading}
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
    <label className="block">
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
