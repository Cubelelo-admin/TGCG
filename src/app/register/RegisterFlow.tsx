"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  attendeeFieldsSchema,
  type AttendeeFieldsInput,
} from "@/lib/registration-schema";
import type { Addon, TicketCategory } from "@/lib/types";
import type {} from "@/types/razorpay";

const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AttendeeFieldsInput>({
    resolver: zodResolver(attendeeFieldsSchema),
  });

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
        theme: { color: "#10b981" },
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
      <div className="mt-10">
        <TicketPicker
          categories={categories}
          addons={addons}
          categoryId={categoryId}
          addonIds={addonIds}
          onSelectCategory={setCategoryId}
          onToggleAddon={toggleAddon}
        />
        <div className="mt-8 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div>
            <p className="text-sm text-neutral-400">Total</p>
            <p className="text-2xl font-bold text-emerald-400">
              ₹{total.toLocaleString("en-IN")}
            </p>
          </div>
          <button
            type="button"
            disabled={!categoryId}
            onClick={() => setStep("details")}
            className="rounded-full bg-emerald-500 px-8 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmitDetails)} className="mt-10 space-y-8">
      <button
        type="button"
        onClick={() => setStep("select")}
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        &larr; Back to ticket selection
      </button>

      <p className="text-sm text-neutral-400">
        {selectedCategory?.name} · ₹{total.toLocaleString("en-IN")}
      </p>

      <FormSection title="Attendee Details">
        <Field label="Full Name" error={errors.fullName?.message}>
          <input {...register("fullName")} className={inputClass} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email (tickets will be sent here)" error={errors.email?.message}>
            <input type="email" {...register("email")} className={inputClass} />
          </Field>
          <Field label="Confirm Email" error={errors.confirmEmail?.message}>
            <input type="email" {...register("confirmEmail")} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Contact Number" error={errors.phone?.message}>
            <input {...register("phone")} placeholder="10-digit mobile number" className={inputClass} />
          </Field>
          <Field label="Emergency Contact Number" error={errors.emergencyPhone?.message}>
            <input {...register("emergencyPhone")} placeholder="10-digit mobile number" className={inputClass} />
          </Field>
        </div>

        <Field label="Gender" error={errors.gender?.message}>
          <div className="flex gap-6">
            {(["male", "female", "others"] as const).map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm capitalize">
                <input type="radio" value={g} {...register("gender")} /> {g}
              </label>
            ))}
          </div>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" error={errors.city?.message}>
            <input {...register("city")} className={inputClass} />
          </Field>
          <Field label="Date of Birth" error={errors.dateOfBirth?.message}>
            <input type="date" {...register("dateOfBirth")} className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Organization (optional)">
            <input {...register("organization")} className={inputClass} />
          </Field>
          <Field label="Running community (optional)">
            <input {...register("runningCommunity")} className={inputClass} />
          </Field>
        </div>

        <Field label="Unisex T-Shirt Size" error={errors.tshirtSize?.message}>
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
      </FormSection>

      {selectedCategory?.requires_kyc && (
        <FormSection
          title="Prize Money Details"
          subtitle="Required for competitive categories so we can process prize money and verify eligibility."
        >
          <Field label="Aadhar Card Number (any Govt ID)" error={errors.aadharNumber?.message}>
            <input {...register("aadharNumber")} className={inputClass} />
          </Field>
          <Field label="Upload Govt ID proof">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setGovtIdFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-neutral-300 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-950"
            />
          </Field>
          <Field label="Bank Name and Location" error={errors.bankNameLocation?.message}>
            <input {...register("bankNameLocation")} className={inputClass} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Bank Account Number" error={errors.bankAccountNumber?.message}>
              <input {...register("bankAccountNumber")} className={inputClass} />
            </Field>
            <Field label="Bank IFSC Code" error={errors.bankIfsc?.message}>
              <input {...register("bankIfsc")} className={inputClass} />
            </Field>
          </div>
          <Field label="PAN Card Number (optional)" error={errors.panNumber?.message}>
            <input {...register("panNumber")} className={inputClass} />
          </Field>
        </FormSection>
      )}

      <FormSection title="Terms">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" {...register("acceptedWaiver")} className="mt-1" />
          Accident Waiver &amp; Swachh Bharat Abhiyan
        </label>
        {errors.acceptedWaiver && <p className={errorClass}>{errors.acceptedWaiver.message}</p>}

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" {...register("acceptedRules")} className="mt-1" />
          I have read and understood all rules and regulations and agree to it.
        </label>
        {errors.acceptedRules && <p className={errorClass}>{errors.acceptedRules.message}</p>}
      </FormSection>

      {serverError && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-emerald-500 px-8 py-4 text-base font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Processing..." : `Pay ₹${total.toLocaleString("en-IN")}`}
      </button>
    </form>
  );
}

function TicketPicker({
  categories,
  addons,
  categoryId,
  addonIds,
  onSelectCategory,
  onToggleAddon,
}: {
  categories: TicketCategory[];
  addons: Addon[];
  categoryId: string | null;
  addonIds: string[];
  onSelectCategory: (id: string) => void;
  onToggleAddon: (id: string) => void;
}) {
  const groups: { key: TicketCategory["group"]; label: string }[] = [
    { key: "competitive", label: "Competitive (नकद पुरस्कार श्रेणी)" },
    { key: "non_competitive", label: "Non-Competitive" },
  ];

  return (
    <div className="space-y-8">
      {groups.map(({ key, label }) => {
        const group = categories.filter((c) => c.group === key);
        if (group.length === 0) return null;
        return (
          <div key={key}>
            <h2 className="font-semibold text-lg">{label}</h2>
            <div className="mt-3 space-y-3">
              {group.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-start justify-between rounded-xl border p-4 transition ${
                    categoryId === c.id
                      ? "border-emerald-400 bg-emerald-400/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="category"
                      className="mt-1"
                      checked={categoryId === c.id}
                      onChange={() => onSelectCategory(c.id)}
                    />
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.description && (
                        <p className="mt-1 text-sm text-neutral-400">{c.description}</p>
                      )}
                      {c.min_age && (
                        <p className="mt-1 text-xs text-neutral-500">
                          Age eligibility: {c.min_age}+ years
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="font-semibold text-emerald-400 whitespace-nowrap">
                    ₹{Number(c.price_inr).toLocaleString("en-IN")}
                  </p>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {addons.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg">Add-ons</h2>
          <div className="mt-3 space-y-3">
            {addons.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-start justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/20"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={addonIds.includes(a.id)}
                    onChange={() => onToggleAddon(a.id)}
                  />
                  <div>
                    <p className="font-medium">{a.name}</p>
                    {a.description && (
                      <p className="mt-1 text-sm text-neutral-400">{a.description}</p>
                    )}
                  </div>
                </div>
                <p className="font-semibold text-emerald-400 whitespace-nowrap">
                  ₹{Number(a.price_inr).toLocaleString("en-IN")}
                </p>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-neutral-300">{label}</span>
      {children}
      {error && <p className={errorClass}>{error}</p>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-emerald-400 focus:outline-none";
const errorClass = "mt-1 text-xs text-red-400";
