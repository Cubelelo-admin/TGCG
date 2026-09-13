"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  attendeeFieldsSchema,
  type AttendeeFieldsInput,
} from "@/lib/registration-schema";
import type { Addon, TicketCategory, TicketGroup } from "@/lib/types";
import type {} from "@/types/razorpay";

const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
const ACCENT = "#5b3fa0";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function RegisterFlow({
  categories,
  addons,
  eventName,
  initialCategoryId,
}: {
  categories: TicketCategory[];
  addons: Addon[];
  eventName: string;
  initialCategoryId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "details">("select");
  const [categoryId, setCategoryId] = useState<string | null>(
    initialCategoryId ?? null
  );
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [govtIdFile, setGovtIdFile] = useState<File | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    competitive: true,
    non_competitive: false,
  });

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId]
  );

  const total = useMemo(() => {
    const base = selectedCategory ? Number(selectedCategory.price_inr) : 0;
    const addonsTotal = addons
      .filter((a) => addonIds.includes(a.id))
      .reduce((sum, a) => sum + Number(a.price_inr), 0);
    return base + addonsTotal;
  }, [selectedCategory, addonIds, addons]);

  const itemCount = (categoryId ? 1 : 0) + addonIds.length;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AttendeeFieldsInput>({
    resolver: zodResolver(attendeeFieldsSchema),
  });
  const email = watch("email");
  const confirmEmail = watch("confirmEmail");

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAddon(id: string) {
    setAddonIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  async function onSubmitDetails(data: AttendeeFieldsInput) {
    if (!selectedCategory) return;
    setServerError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("ticketCategoryId", selectedCategory.id);
      formData.set("addonIds", JSON.stringify(addonIds));
      Object.entries(data).forEach(([key, value]) => {
        formData.set(key, String(value));
      });
      if (govtIdFile) formData.set("govtIdFile", govtIdFile);

      const res = await fetch("/api/register", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) {
        setServerError(json.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setServerError("Could not load payment gateway. Check your connection and try again.");
        setSubmitting(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: json.keyId,
        amount: json.amount,
        currency: json.currency,
        name: eventName,
        description: selectedCategory.name,
        order_id: json.orderId,
        prefill: { name: data.fullName, email: data.email, contact: data.phone },
        theme: { color: ACCENT },
        handler: async (response) => {
          try {
            await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                registrationId: json.registrationId,
                ...response,
              }),
            });
          } finally {
            router.push(`/register/success?reg=${json.registrationId}`);
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
      });
      rzp.open();
    } catch {
      setServerError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (step === "select") {
    return (
      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <TicketAccordion
            categories={categories}
            categoryId={categoryId}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            onSelectCategory={setCategoryId}
          />
        </div>
        <SummaryCard
          total={total}
          itemCount={itemCount}
          ctaLabel="Proceed"
          ctaDisabled={!categoryId}
          onCta={() => setStep("details")}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start">
      <form onSubmit={handleSubmit(onSubmitDetails)} className="min-w-0 flex-1 space-y-6">
        <div>
          <button
            type="button"
            onClick={() => setStep("select")}
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827]"
          >
            <BackArrowIcon /> Attendee Details
          </button>
          <p className="mt-1 text-sm text-[#6b7280]">{eventName}</p>
        </div>

        <p className="text-sm font-semibold text-[#111827]">{selectedCategory?.name}</p>

        <FormCard title="Attendee Details" icon={<PersonIcon />}>
          <Field label="Full Name" required error={errors.fullName?.message}>
            <input {...register("fullName")} className={inputClass} />
          </Field>
          <Field label="Email (Tickets will be sent to this email)" required error={errors.email?.message}>
            <input type="email" {...register("email")} className={inputClass} />
          </Field>
          <Field
            label="Confirm Email (Should match with email provided above)"
            required
            error={errors.confirmEmail?.message}
            trailing={
              confirmEmail && email && confirmEmail === email ? <CheckIcon /> : null
            }
          >
            <input type="email" {...register("confirmEmail")} className={inputClass} />
          </Field>
          <Field label="Contact Number" required error={errors.phone?.message}>
            <input {...register("phone")} placeholder="10-digit mobile number" className={inputClass} />
          </Field>

          <Field label="Gender" required error={errors.gender?.message}>
            <div className="flex gap-6 pt-1">
              {(["male", "female", "others"] as const).map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm capitalize text-[#374151]">
                  <input type="radio" value={g} {...register("gender")} style={{ accentColor: ACCENT }} /> {g}
                </label>
              ))}
            </div>
          </Field>

          <Field label="City" required error={errors.city?.message}>
            <input {...register("city")} className={inputClass} />
          </Field>
          <Field label="Organization">
            <input {...register("organization")} className={inputClass} />
          </Field>
          <Field label="If you are part of Running community please name it">
            <input {...register("runningCommunity")} className={inputClass} />
          </Field>
          <Field label="Date Of Birth" required error={errors.dateOfBirth?.message}>
            <input type="date" {...register("dateOfBirth")} className={inputClass} />
          </Field>
          <Field
            label="Unisex T Shirt Size (Sub. to availability 1st come 1st Serve)"
            required
            error={errors.tshirtSize?.message}
          >
            <select {...register("tshirtSize")} className={inputClass} defaultValue="">
              <option value="" disabled>
                Select size
              </option>
              {TSHIRT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Emergency Contact Number" required error={errors.emergencyPhone?.message}>
            <input {...register("emergencyPhone")} placeholder="10-digit mobile number" className={inputClass} />
          </Field>

          {selectedCategory?.requires_kyc && (
            <>
              <Field label="Aadhar Card Number (Any Govt ID)" required error={errors.aadharNumber?.message}>
                <input {...register("aadharNumber")} className={inputClass} />
              </Field>
              <Field label="Upload Govt ID proof" required>
                <label
                  className="mt-1 inline-flex cursor-pointer items-center rounded-md border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  {govtIdFile ? govtIdFile.name : "Upload File"}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setGovtIdFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </Field>
              <Field label="Bank Name and Location (for prize money please provide)" required error={errors.bankNameLocation?.message}>
                <input {...register("bankNameLocation")} className={inputClass} />
              </Field>
              <Field label="Bank Account Number (for prize money please provide)" required error={errors.bankAccountNumber?.message}>
                <input {...register("bankAccountNumber")} className={inputClass} />
              </Field>
              <Field label="Bank IFSC code (for prize money please provide)" required error={errors.bankIfsc?.message}>
                <input {...register("bankIfsc")} className={inputClass} />
              </Field>
              <Field label="PAN Card Number (for prize money please provide)" error={errors.panNumber?.message}>
                <input {...register("panNumber")} className={inputClass} />
              </Field>
            </>
          )}

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 text-sm text-[#374151]">
              <input type="checkbox" {...register("acceptedWaiver")} className="mt-1" style={{ accentColor: ACCENT }} />
              Accident Waiver &amp; Swachh Bharat Abhiyan
            </label>
            {errors.acceptedWaiver && <p className={errorClass}>{errors.acceptedWaiver.message}</p>}

            <label className="flex items-start gap-3 text-sm text-[#374151]">
              <input type="checkbox" {...register("acceptedRules")} className="mt-1" style={{ accentColor: ACCENT }} />
              I have read and understood all rules and regulations and agree to it.
            </label>
            {errors.acceptedRules && <p className={errorClass}>{errors.acceptedRules.message}</p>}
          </div>
        </FormCard>

        {addons.length > 0 && (
          <FormCard title="Add Ons">
            {addons.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] py-4 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{a.name}</p>
                  <p className="text-sm text-[#111827]">₹{Number(a.price_inr).toLocaleString("en-IN")}</p>
                  {a.description && <p className="mt-1 text-sm text-[#6b7280]">{a.description}</p>}
                </div>
                <ToggleButton selected={addonIds.includes(a.id)} onClick={() => toggleAddon(a.id)} />
              </div>
            ))}
          </FormCard>
        )}

        {serverError && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md py-3.5 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {submitting ? "Processing..." : `Pay ₹${total.toLocaleString("en-IN")}`}
        </button>
      </form>

      <SummaryCard total={total} itemCount={itemCount} />
    </div>
  );
}

function TicketAccordion({
  categories,
  categoryId,
  openGroups,
  onToggleGroup,
  onSelectCategory,
}: {
  categories: TicketCategory[];
  categoryId: string | null;
  openGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onSelectCategory: (id: string | null) => void;
}) {
  const groups: { key: TicketGroup; label: string }[] = [
    { key: "competitive", label: "All Competitive Tickets (नकद पुरस्कार श्रेणी)" },
    { key: "non_competitive", label: "All Non Competitive Tickets" },
  ];

  return (
    <div className="border-t border-[#e5e7eb]">
      {groups.map(({ key, label }) => {
        const group = categories.filter((c) => c.group === key);
        if (group.length === 0) return null;
        const open = openGroups[key];
        return (
          <div key={key} className="border-b border-[#e5e7eb]">
            <button
              type="button"
              onClick={() => onToggleGroup(key)}
              className="flex w-full items-center gap-3 py-4 text-left"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}
              >
                {open ? "−" : "+"}
              </span>
              <span className="text-sm font-bold uppercase tracking-wide text-[#111827]">{label}</span>
            </button>

            {open && (
              <div className="pb-2">
                {group.map((c) => {
                  const selected = categoryId === c.id;
                  return (
                    <div key={c.id} className="flex items-start justify-between gap-4 border-t border-[#f0f0f1] py-4">
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">{c.name}</p>
                        <p className="mt-1 text-sm text-[#111827]">
                          ₹{Number(c.price_inr).toLocaleString("en-IN")}
                        </p>
                        {c.description && (
                          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#6b7280]">{c.description}</p>
                        )}
                        {c.min_age && (
                          <p className="mt-2 text-sm text-[#6b7280]">
                            Age Eligibility: {c.min_age} years &amp; above
                          </p>
                        )}
                      </div>
                      <ToggleButton
                        selected={selected}
                        onClick={() => onSelectCategory(selected ? null : c.id)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ToggleButton({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  if (selected) {
    return (
      <div
        className="flex shrink-0 items-center gap-3 rounded-md border px-3 py-1.5"
        style={{ borderColor: ACCENT }}
      >
        <button
          type="button"
          onClick={onClick}
          className="text-base font-bold leading-none"
          style={{ color: ACCENT }}
          aria-label="Remove"
        >
          −
        </button>
        <span className="text-sm font-semibold text-[#111827]">1</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md border px-4 py-1.5 text-sm font-bold"
      style={{ borderColor: ACCENT, color: ACCENT }}
    >
      + ADD
    </button>
  );
}

function SummaryCard({
  total,
  itemCount,
  ctaLabel,
  ctaDisabled,
  onCta,
}: {
  total: number;
  itemCount: number;
  ctaLabel?: string;
  ctaDisabled?: boolean;
  onCta?: () => void;
}) {
  return (
    <div className="w-full shrink-0 lg:sticky lg:top-6 lg:w-80">
      <div className="rounded-md border border-[#e5e7eb] p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280]">Summary</p>
        <div className="mt-3 flex items-center justify-between text-sm text-[#6b7280]">
          <span>Price ({itemCount} item{itemCount === 1 ? "" : "s"})</span>
          <span>₹{total.toLocaleString("en-IN")}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[#e5e7eb] pt-2">
          <span className="text-sm font-bold" style={{ color: ACCENT }}>
            Total Amount
          </span>
          <span className="text-sm font-bold" style={{ color: ACCENT }}>
            ₹{total.toLocaleString("en-IN")}
          </span>
        </div>
        <p className="mt-1 text-xs text-[#9ca3af]">Prices are excluding GST and Booking Fees</p>
      </div>

      {ctaLabel && (
        <button
          type="button"
          disabled={ctaDisabled}
          onClick={onCta}
          className="mt-4 flex w-full items-center justify-between rounded-md px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          <span className="flex items-center gap-2">
            <PersonIcon small /> {itemCount || 0}
          </span>
          {ctaLabel} &rsaquo;
        </button>
      )}
    </div>
  );
}

function FormCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#e5e7eb]">
      <div className="flex items-center gap-2 border-b border-[#e5e7eb] bg-[#f9fafb] px-5 py-3">
        {icon}
        <h2 className="text-sm font-bold text-[#111827]">{title}</h2>
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  trailing,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-[#374151]">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <div className="relative">
        {children}
        {trailing && <span className="absolute right-0 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      {error && <p className={errorClass}>{error}</p>}
    </label>
  );
}

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#22c55e" opacity="0.15" />
      <path d="M7 12.5l3 3 7-7" stroke="#16a34a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonIcon({ small }: { small?: boolean }) {
  const s = small ? 16 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

const inputClass =
  "w-full border-0 border-b border-[#d1d5db] bg-transparent px-0 py-2 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-current focus:outline-none";
const errorClass = "mt-1 text-xs text-red-600";
