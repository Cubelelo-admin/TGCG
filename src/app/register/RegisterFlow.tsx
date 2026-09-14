"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  attendeeFieldsSchema,
  MAX_GROUP_SIZE,
  phoneRegex as PHONE_REGEX,
  type AttendeeFieldsInput,
} from "@/lib/registration-schema";
import type { Addon, TicketCategory, TicketGroup } from "@/lib/types";
import type {} from "@/types/razorpay";

const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
const ACCENT = "#5b3fa0";

/** Decodes a JWT payload for display only — never trusted; the server independently verifies the token's signature. */
function decodeJwtPayload(token: string): { email?: string } {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

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

type AttendeeCartItem = AttendeeFieldsInput & {
  clientKey: string;
  categoryId: string;
  addonIds: string[];
  govtIdFile: File | null;
};

let clientKeyCounter = 0;
function nextClientKey(): string {
  clientKeyCounter += 1;
  return `attendee-${clientKeyCounter}`;
}

function toPersonalFields(item: AttendeeCartItem): AttendeeFieldsInput {
  return {
    fullName: item.fullName,
    phone: item.phone,
    gender: item.gender,
    city: item.city,
    organization: item.organization,
    runningCommunity: item.runningCommunity,
    dateOfBirth: item.dateOfBirth,
    tshirtSize: item.tshirtSize,
    emergencyPhone: item.emergencyPhone,
    aadharNumber: item.aadharNumber,
    bankNameLocation: item.bankNameLocation,
    bankAccountNumber: item.bankAccountNumber,
    bankIfsc: item.bankIfsc,
    panNumber: item.panNumber,
    acceptedWaiver: item.acceptedWaiver,
    acceptedRules: item.acceptedRules,
  };
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

  const [attendees, setAttendees] = useState<AttendeeCartItem[]>([]);
  // null = filling a brand-new attendee; otherwise the index of a saved attendee being edited.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // true = the attendee form is on screen (adding or editing); false = the
  // "So Far" recap + Add Participant/Checkout buttons are on screen instead.
  const [showForm, setShowForm] = useState(true);

  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(initialCategoryId ?? null);
  const [draftAddonIds, setDraftAddonIds] = useState<string[]>([]);
  const [draftGovtIdFile, setDraftGovtIdFile] = useState<File | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    competitive: false,
    non_competitive: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Phone-OTP verification for the primary (first) attendee only — Checkout
  // is hard-gated on this server-side too (see api/register/route.ts).
  // otpSentForPhone tracks *which* number the current code was sent to, so
  // editing the phone field after sending doesn't leave a stale "enter code"
  // box showing for a number that was never actually texted.
  const [otpSentForPhone, setOtpSentForPhone] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpVerifiedPhone, setOtpVerifiedPhone] = useState<string | null>(null);

  const draftCategory = useMemo(
    () => categories.find((c) => c.id === draftCategoryId) ?? null,
    [categories, draftCategoryId]
  );

  const draftTotal = useMemo(() => {
    const base = draftCategory ? Number(draftCategory.price_inr) : 0;
    const addonsTotal = addons
      .filter((a) => draftAddonIds.includes(a.id))
      .reduce((sum, a) => sum + Number(a.price_inr), 0);
    return base + addonsTotal;
  }, [draftCategory, draftAddonIds, addons]);

  function attendeeTotal(item: AttendeeCartItem) {
    const category = categories.find((c) => c.id === item.categoryId);
    const base = category ? Number(category.price_inr) : 0;
    const addonsTotal = addons
      .filter((a) => item.addonIds.includes(a.id))
      .reduce((sum, a) => sum + Number(a.price_inr), 0);
    return base + addonsTotal;
  }

  // Already-saved attendees other than the one currently being drafted/edited.
  const otherAttendees = attendees.filter((_, i) => i !== editingIndex);
  const otherTotal = otherAttendees.reduce((sum, a) => sum + attendeeTotal(a), 0);
  const projectedTotal = otherTotal + draftTotal;
  const projectedCount = otherAttendees.length + (draftCategory ? 1 : 0);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AttendeeFieldsInput>({
    resolver: zodResolver(attendeeFieldsSchema),
    // Validate a field as soon as it's left (blur), then keep re-checking
    // live on every keystroke once an error is showing, so a mistake is
    // flagged before the user moves on rather than only at Save.
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  // Mirrors the "phone" field for the OTP widget, kept in sync manually
  // (rather than react-hook-form's watch(), which disables the React
  // Compiler's memoization for this whole component) — updated on user
  // input here, and wherever the draft form's phone value is set
  // programmatically (resetDraft, startEditAttendee).
  const [phoneValue, setPhoneValue] = useState("");
  // Only the very first attendee in the booking needs phone verification.
  const isPrimaryAttendee = editingIndex === 0 || (editingIndex === null && attendees.length === 0);
  const isPhoneVerified = Boolean(phoneValue) && phoneValue === otpVerifiedPhone;
  const showOtpCodeInput = Boolean(phoneValue) && phoneValue === otpSentForPhone && !isPhoneVerified;
  // Checkout's hard gate — attendees[0] must exist and match the verified phone.
  const primaryPhoneVerified = attendees.length > 0 && attendees[0].phone === otpVerifiedPhone;

  async function handleSendOtp() {
    if (!phoneValue || !PHONE_REGEX.test(phoneValue)) return;
    setOtpError(null);
    setOtpSending(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(json.error ?? "Could not send the code. Please try again.");
        return;
      }
      setOtpCode("");
      setOtpSentForPhone(phoneValue);
    } catch {
      setOtpError("Could not send the code. Please try again.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    if (!phoneValue || !otpCode) return;
    setOtpError(null);
    setOtpVerifying(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue, code: otpCode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(json.error ?? "Incorrect code");
        return;
      }
      setOtpVerifiedPhone(phoneValue);
    } catch {
      setOtpError("Could not verify the code. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  }

  // Scrolled into view whenever a fresh/edited draft form replaces what was
  // on screen (after "+ Add Participant" or clicking "Edit"), so the next
  // fields to fill are immediately visible instead of leaving the user
  // scrolled down near whatever button they just clicked.
  const formTopRef = useRef<HTMLDivElement>(null);
  function scrollToFormTop() {
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [organizerEmail, setOrganizerEmail] = useState<string | null>(null);
  const [organizerGoogleIdToken, setOrganizerGoogleIdToken] = useState("");

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN_CLIENT_ID;
    if (
      !googleScriptLoaded ||
      !googleButtonRef.current ||
      !clientId ||
      !window.google ||
      organizerGoogleIdToken
    )
      return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        const payload = decodeJwtPayload(response.credential);
        setOrganizerEmail(payload.email ?? null);
        setOrganizerGoogleIdToken(response.credential);
      },
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      width: 320,
    });
  }, [googleScriptLoaded, organizerGoogleIdToken]);

  function handleChangeGoogleAccount() {
    window.google?.accounts.id.disableAutoSelect();
    setOrganizerEmail(null);
    setOrganizerGoogleIdToken("");
  }

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleDraftAddon(id: string) {
    setDraftAddonIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function resetDraft() {
    setEditingIndex(null);
    setDraftCategoryId(null);
    setDraftAddonIds([]);
    setDraftGovtIdFile(null);
    setCategoryError(null);
    setPhoneValue("");
    reset();
  }

  /** Recap → form: blank slate for a new attendee. */
  function startAddParticipant() {
    resetDraft();
    setServerError(null);
    setShowForm(true);
    scrollToFormTop();
  }

  /** Recap → form: pre-filled with an already-saved attendee's data. */
  function startEditAttendee(index: number) {
    const item = attendees[index];
    setDraftCategoryId(item.categoryId);
    setDraftAddonIds(item.addonIds);
    setDraftGovtIdFile(item.govtIdFile);
    setCategoryError(null);
    setPhoneValue(item.phone);
    reset(toPersonalFields(item));
    setEditingIndex(index);
    setServerError(null);
    setShowForm(true);
    scrollToFormTop();
  }

  /** Form → recap, discarding whatever's in the draft without saving it. */
  function cancelDraft() {
    resetDraft();
    setShowForm(false);
    scrollToFormTop();
  }

  function removeAttendee(index: number) {
    setAttendees((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      // Only reachable defensively — Remove lives in the recap view, where
      // nothing is being edited (editingIndex is always null there).
      cancelDraft();
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
  }

  /**
   * Validates the ticket selection and phone uniqueness, then folds the
   * current form values into the attendees array. Returns the updated
   * array, or null if either check fails (the phone check also flags the
   * "phone" field via react-hook-form so the error shows inline). The
   * server independently re-checks both — this is a client-side UX
   * shortcut, not the source of truth.
   */
  function saveDraft(data: AttendeeFieldsInput): AttendeeCartItem[] | null {
    if (!draftCategory) {
      setCategoryError("Please select a ticket");
      return null;
    }
    const duplicatePhone = attendees.some(
      (a, i) => i !== editingIndex && a.phone === data.phone
    );
    if (duplicatePhone) {
      setError("phone", {
        type: "manual",
        message: "This number is already used by another attendee in this booking",
      });
      return null;
    }

    const item: AttendeeCartItem = {
      ...data,
      categoryId: draftCategory.id,
      addonIds: draftAddonIds,
      govtIdFile: draftGovtIdFile,
      clientKey: editingIndex !== null ? attendees[editingIndex].clientKey : nextClientKey(),
    };

    const next =
      editingIndex !== null
        ? attendees.map((a, i) => (i === editingIndex ? item : a))
        : [...attendees, item];
    setAttendees(next);
    return next;
  }

  /** Form → recap: saves the draft as an attendee, then shows the "So Far" + Add Participant/Checkout screen. */
  function onSaveDraft(data: AttendeeFieldsInput) {
    if (!saveDraft(data)) return;
    resetDraft();
    setShowForm(false);
    scrollToFormTop();
  }

  // Wraps handleSubmit(...) in a stable no-arg handler rather than calling
  // handleSubmit(onSaveDraft) inline in JSX — the latter reads formTopRef
  // (via scrollToFormTop) during render, which React's ref-safety lint rule
  // flags even though the actual read only happens once the returned
  // handler runs, in response to a click.
  function handleSaveClick() {
    void handleSubmit(onSaveDraft)();
  }

  /** Recap-only: no draft is on screen here, so this just checks out with whatever's already saved. */
  function handleCheckoutClick() {
    void proceedToCheckout(attendees);
  }

  async function proceedToCheckout(finalAttendees: AttendeeCartItem[]) {
    if (!organizerGoogleIdToken) return;

    setServerError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("organizerGoogleIdToken", organizerGoogleIdToken);

      const payload = finalAttendees.map((item) => ({
        ...toPersonalFields(item),
        ticketCategoryId: item.categoryId,
        addonIds: item.addonIds,
      }));
      formData.set("attendees", JSON.stringify(payload));
      finalAttendees.forEach((item, i) => {
        if (item.govtIdFile) formData.set(`govtIdFile_${i}`, item.govtIdFile);
      });

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
        description: `${finalAttendees.length} attendee${finalAttendees.length === 1 ? "" : "s"} — TGCG 2026`,
        order_id: json.orderId,
        prefill: {
          name: finalAttendees[0]?.fullName,
          email: organizerEmail ?? undefined,
          contact: finalAttendees[0]?.phone,
        },
        theme: { color: ACCENT },
        handler: async (response) => {
          try {
            await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                groupId: json.groupId,
                ...response,
              }),
            });
          } finally {
            router.push(`/register/success?group=${json.groupId}`);
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

  const summaryItems = [
    ...otherAttendees.map((a, i) => {
      const originalIndex = attendees.indexOf(a);
      return {
        label: `${a.fullName} — ${categories.find((c) => c.id === a.categoryId)?.name ?? ""}`,
        amount: attendeeTotal(a),
        onEdit: () => startEditAttendee(originalIndex),
        onRemove: () => removeAttendee(originalIndex),
        key: a.clientKey ?? i,
      };
    }),
  ];

  return (
    <div className="mt-6">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGoogleScriptLoaded(true)}
      />

      {!organizerGoogleIdToken ? (
        <SignInGate googleButtonRef={googleButtonRef} />
      ) : (
        <>
          <OrganizerBar email={organizerEmail} onChange={handleChangeGoogleAccount} />
          <AttendeeStep
            eventName={eventName}
            categories={categories}
            addons={addons}
            draftCategoryId={draftCategoryId}
            draftCategory={draftCategory}
            categoryError={categoryError}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            onSelectCategory={(id) => {
              setDraftCategoryId(id);
              if (id) setCategoryError(null);
            }}
            addonIds={draftAddonIds}
            onToggleAddon={toggleDraftAddon}
            govtIdFile={draftGovtIdFile}
            onGovtIdFile={setDraftGovtIdFile}
            register={register}
            errors={errors}
            isEditing={editingIndex !== null}
            showForm={showForm}
            canCancel={attendees.length > 0}
            onSave={handleSaveClick}
            onCancelDraft={cancelDraft}
            onAddParticipant={startAddParticipant}
            onCheckout={handleCheckoutClick}
            formTopRef={formTopRef}
            addDisabled={attendees.length >= MAX_GROUP_SIZE}
            submitting={submitting}
            isPrimaryAttendee={isPrimaryAttendee}
            phoneValue={phoneValue}
            onPhoneChange={setPhoneValue}
            isPhoneVerified={isPhoneVerified}
            showOtpCodeInput={showOtpCodeInput}
            otpCode={otpCode}
            onOtpCodeChange={setOtpCode}
            otpSending={otpSending}
            otpVerifying={otpVerifying}
            otpError={otpError}
            onSendOtp={() => void handleSendOtp()}
            onVerifyOtp={() => void handleVerifyOtp()}
            primaryPhoneVerified={primaryPhoneVerified}
            serverError={serverError}
            summaryTitle={summaryItems.length > 0 ? "So Far" : "Summary"}
            summaryItems={summaryItems}
            projectedTotal={projectedTotal}
            projectedCount={projectedCount}
            checkoutLabel={submitting ? "Processing..." : `Checkout — Pay ₹${projectedTotal.toLocaleString("en-IN")}`}
          />
        </>
      )}
    </div>
  );
}

function SignInGate({ googleButtonRef }: { googleButtonRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="mx-auto max-w-md rounded-md border border-[#e5e7eb] p-8 text-center">
      <h2 className="text-lg font-bold text-[#111827]">Sign in to register</h2>
      <p className="mt-2 text-sm text-[#6b7280]">
        Sign in with Google to verify your email, then add up to {MAX_GROUP_SIZE} attendees in
        one booking and pay once.
      </p>
      <div className="mt-6 flex justify-center">
        <div ref={googleButtonRef} />
      </div>
    </div>
  );
}

function OrganizerBar({ email, onChange }: { email: string | null; onChange: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-sm text-[#6b7280]">
      <CheckIcon />
      <span>Signed in as {email}</span>
      <button
        type="button"
        onClick={onChange}
        className="text-xs font-medium underline"
        style={{ color: ACCENT }}
      >
        Change
      </button>
    </div>
  );
}

function AttendeeStep({
  eventName,
  categories,
  addons,
  draftCategoryId,
  draftCategory,
  categoryError,
  openGroups,
  onToggleGroup,
  onSelectCategory,
  addonIds,
  onToggleAddon,
  govtIdFile,
  onGovtIdFile,
  register,
  errors,
  isEditing,
  showForm,
  canCancel,
  onSave,
  onCancelDraft,
  onAddParticipant,
  onCheckout,
  formTopRef,
  addDisabled,
  submitting,
  isPrimaryAttendee,
  phoneValue,
  onPhoneChange,
  isPhoneVerified,
  showOtpCodeInput,
  otpCode,
  onOtpCodeChange,
  otpSending,
  otpVerifying,
  otpError,
  onSendOtp,
  onVerifyOtp,
  primaryPhoneVerified,
  serverError,
  summaryTitle,
  summaryItems,
  projectedTotal,
  projectedCount,
  checkoutLabel,
}: {
  eventName: string;
  categories: TicketCategory[];
  addons: Addon[];
  draftCategoryId: string | null;
  draftCategory: TicketCategory | null;
  categoryError: string | null;
  openGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onSelectCategory: (id: string | null) => void;
  addonIds: string[];
  onToggleAddon: (id: string) => void;
  govtIdFile: File | null;
  onGovtIdFile: (file: File | null) => void;
  register: UseFormRegister<AttendeeFieldsInput>;
  errors: FieldErrors<AttendeeFieldsInput>;
  isEditing: boolean;
  /** true = the attendee form is showing; false = the "So Far" recap + Add Participant/Checkout buttons are. */
  showForm: boolean;
  /** Whether there's a saved-attendees recap to cancel back to. */
  canCancel: boolean;
  onSave: () => void;
  onCancelDraft: () => void;
  onAddParticipant: () => void;
  onCheckout: () => void;
  formTopRef: RefObject<HTMLDivElement | null>;
  addDisabled: boolean;
  submitting: boolean;
  /** Whether the currently-shown draft is the first attendee — only they need phone verification. */
  isPrimaryAttendee: boolean;
  phoneValue: string;
  onPhoneChange: (value: string) => void;
  isPhoneVerified: boolean;
  showOtpCodeInput: boolean;
  otpCode: string;
  onOtpCodeChange: (code: string) => void;
  otpSending: boolean;
  otpVerifying: boolean;
  otpError: string | null;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
  /** Checkout's hard gate — the first attendee's phone must be verified. */
  primaryPhoneVerified: boolean;
  serverError: string | null;
  summaryTitle: string;
  summaryItems: { label: string; amount: number; onEdit: () => void; onRemove: () => void; key: string | number }[];
  projectedTotal: number;
  projectedCount: number;
  checkoutLabel: string;
}) {
  return (
    <div>
      <form className="mx-auto max-w-xl space-y-6">
        <div ref={formTopRef} className="scroll-mt-6">
          <p className="text-sm text-[#6b7280]">{eventName}</p>
        </div>

        {summaryItems.length > 0 && (
          <SummaryCard
            title={summaryTitle}
            items={summaryItems}
            total={projectedTotal}
            itemCount={projectedCount}
          />
        )}

        {showForm && (
        <>
        <FormCard
          title={isEditing ? "Edit Attendee" : "Attendee Details"}
          icon={<PersonIcon />}
          action={
            canCancel && (
              <button
                type="button"
                onClick={onCancelDraft}
                className="text-xs font-medium underline"
                style={{ color: ACCENT }}
              >
                Cancel
              </button>
            )
          }
        >
          <Field label="Full Name" required error={errors.fullName?.message}>
            <input {...register("fullName")} className={inputClass} />
          </Field>
          <Field label="Contact Number" required error={errors.phone?.message}>
            <input
              {...register("phone", { onChange: (e) => onPhoneChange(e.target.value) })}
              placeholder="10-digit mobile number"
              className={inputClass}
            />
          </Field>

          {isPrimaryAttendee && (
            <OtpVerification
              phoneValid={PHONE_REGEX.test(phoneValue)}
              isPhoneVerified={isPhoneVerified}
              showCodeInput={showOtpCodeInput}
              code={otpCode}
              onCodeChange={onOtpCodeChange}
              sending={otpSending}
              verifying={otpVerifying}
              error={otpError}
              onSend={onSendOtp}
              onVerify={onVerifyOtp}
            />
          )}

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
        </FormCard>

        <FormCard title="Select Ticket">
          <TicketAccordion
            categories={categories}
            categoryId={draftCategoryId}
            openGroups={openGroups}
            onToggleGroup={onToggleGroup}
            onSelectCategory={onSelectCategory}
          />
          {categoryError && <p className={errorClass}>{categoryError}</p>}
        </FormCard>

        {draftCategory?.requires_kyc && (
          <FormCard title="Prize Money KYC">
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
                  onChange={(e) => onGovtIdFile(e.target.files?.[0] ?? null)}
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
          </FormCard>
        )}

        {addons.length > 0 && (
          <FormCard title="Add Ons">
            {addons.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] py-4 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{a.name}</p>
                  <p className="text-sm text-[#111827]">₹{Number(a.price_inr).toLocaleString("en-IN")}</p>
                  {a.description && <p className="mt-1 text-sm text-[#6b7280]">{a.description}</p>}
                </div>
                <ToggleButton selected={addonIds.includes(a.id)} onClick={() => onToggleAddon(a.id)} />
              </div>
            ))}
          </FormCard>
        )}

        <FormCard title="Consent">
          <div className="space-y-3">
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

        <button
          type="button"
          onClick={onSave}
          className="w-full rounded-md py-3.5 text-base font-semibold text-white transition"
          style={{ backgroundColor: ACCENT }}
        >
          Save
        </button>
        </>
        )}

        {!showForm && (
          <>
            {serverError && (
              <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onAddParticipant}
                disabled={addDisabled}
                className="flex-1 rounded-md border py-3.5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                + Add Participant{addDisabled ? ` (max ${MAX_GROUP_SIZE})` : ""}
              </button>
              <button
                type="button"
                onClick={onCheckout}
                disabled={submitting || !primaryPhoneVerified}
                className="flex-1 rounded-md py-3.5 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {checkoutLabel}
              </button>
            </div>
            {!primaryPhoneVerified && (
              <p className="text-sm text-[#6b7280]">
                Verify the first participant&apos;s phone number before checking out.
                {summaryItems[0]?.onEdit && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={summaryItems[0].onEdit}
                      className="font-medium underline"
                      style={{ color: ACCENT }}
                    >
                      Verify now
                    </button>
                  </>
                )}
              </p>
            )}
          </>
        )}
      </form>
    </div>
  );
}

function OtpVerification({
  phoneValid,
  isPhoneVerified,
  showCodeInput,
  code,
  onCodeChange,
  sending,
  verifying,
  error,
  onSend,
  onVerify,
}: {
  phoneValid: boolean;
  isPhoneVerified: boolean;
  showCodeInput: boolean;
  code: string;
  onCodeChange: (code: string) => void;
  sending: boolean;
  verifying: boolean;
  error: string | null;
  onSend: () => void;
  onVerify: () => void;
}) {
  if (isPhoneVerified) {
    return (
      <p className="-mt-3 flex items-center gap-1.5 text-sm font-medium text-green-700">
        <CheckIcon /> Phone number verified
      </p>
    );
  }

  return (
    <div className="-mt-3 space-y-2">
      {!showCodeInput ? (
        <button
          type="button"
          onClick={onSend}
          disabled={!phoneValid || sending}
          className="text-sm font-semibold underline disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: ACCENT }}
        >
          {sending ? "Sending code..." : "Send OTP to verify this number"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="6-digit code"
            inputMode="numeric"
            maxLength={6}
            className={`${inputClass} max-w-[140px]`}
          />
          <button
            type="button"
            onClick={onVerify}
            disabled={verifying || code.length === 0}
            className="rounded-md border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            {verifying ? "Verifying..." : "Verify"}
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            className="text-xs font-medium underline disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: ACCENT }}
          >
            Resend code
          </button>
        </div>
      )}
      {error && <p className={errorClass}>{error}</p>}
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
  title = "Summary",
  items,
  total,
  itemCount,
}: {
  title?: string;
  items?: { label: string; amount: number; onEdit?: () => void; onRemove?: () => void; key?: string | number }[];
  total: number;
  itemCount: number;
}) {
  return (
    <div className="w-full shrink-0">
      <div className="rounded-md border border-[#e5e7eb] p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280]">{title}</p>

        {items && items.length > 0 && (
          <div className="mt-3 space-y-3 border-b border-[#e5e7eb] pb-3">
            {items.map((item, i) => (
              <div key={item.key ?? i} className="text-sm text-[#374151]">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate">{item.label}</span>
                  <span className="shrink-0">₹{item.amount.toLocaleString("en-IN")}</span>
                </div>
                {(item.onEdit || item.onRemove) && (
                  <div className="mt-0.5 flex gap-3">
                    {item.onEdit && (
                      <button
                        type="button"
                        onClick={item.onEdit}
                        className="text-xs font-medium underline"
                        style={{ color: ACCENT }}
                      >
                        Edit
                      </button>
                    )}
                    {item.onRemove && (
                      <button
                        type="button"
                        onClick={item.onRemove}
                        className="text-xs font-medium text-red-600 underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

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
    </div>
  );
}

function FormCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  /** Rendered right-aligned in the header bar, e.g. a "Cancel" link. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#e5e7eb]">
      <div className="flex items-center justify-between gap-2 border-b border-[#e5e7eb] bg-[#f9fafb] px-5 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold text-[#111827]">{title}</h2>
        </div>
        {action}
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
