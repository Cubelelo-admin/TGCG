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

  const [form, setForm] = useState({
    fullName: registration.full_name,
    email: registration.email ?? "",
    phone: registration.phone ?? "",
    gender: registration.gender ?? GENDERS[0],
    city: registration.city ?? "",
    tshirtSize: registration.tshirt_size ?? TSHIRT_SIZES[0],
    bibNumber: registration.bib_number ?? "",
    checkedIn: registration.checked_in,
    ticketCategoryId: registration.ticket_category_id,
  });

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
        onClick={() => setOpen(true)}
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
                disabled={saving}
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
