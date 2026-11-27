"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  attendeeFieldsSchema,
  childRunnerSchema,
  MAX_GROUP_SIZE,
  phoneRegex as PHONE_REGEX,
  type AttendeeFieldsInput,
  type ChildRunnerInput,
} from "@/lib/registration-schema";
import type { Addon, TicketCategory, TicketGroup } from "@/lib/types";
import type {} from "@/types/razorpay";
import { CHECKOUT_MAX_BYTES, prepareGovtIdFile } from "@/lib/govt-id-upload";

const ACCENT = "#5b3fa0";

// Generic unisex round-neck reference chart — not the actual vendor's spec.
// Swap these for the real supplier's measurements once available.
const TSHIRT_SIZE_CHART: { size: string; chest: string; length: string }[] = [
  { size: "XS", chest: "34", length: "26" },
  { size: "S", chest: "36", length: "27" },
  { size: "M", chest: "38", length: "28" },
  { size: "L", chest: "40", length: "29" },
  { size: "XL", chest: "42", length: "30" },
  { size: "XXL", chest: "44", length: "31" },
  { size: "XXXL", chest: "46", length: "32" },
];

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
  childCategory,
  eventName,
  eventShortName,
  initialCategoryId,
}: {
  categories: TicketCategory[];
  addons: Addon[];
  childCategory: TicketCategory | null;
  eventName: string;
  eventShortName: string;
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
  const [govtIdBusy, setGovtIdBusy] = useState(false);
  const [govtIdError, setGovtIdError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    competitive: false,
    non_competitive: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // At most one child runner per booking — a name + age confirmation, no
  // other personal details, no phone/OTP, not counted toward MAX_GROUP_SIZE.
  const [childRunner, setChildRunner] = useState<ChildRunnerInput | null>(null);
  const [showChildForm, setShowChildForm] = useState(false);
  const [childNameDraft, setChildNameDraft] = useState("");
  const [childConfirmDraft, setChildConfirmDraft] = useState(false);
  const [childError, setChildError] = useState<string | null>(null);

  // Phone-OTP verification for the primary (first) attendee only. It's a
  // mandatory first step: the rest of that attendee's form stays locked
  // until it's done, and Checkout is hard-gated on it server-side too (see
  // api/register/route.ts). otpSentForPhone tracks *which* number the
  // current code was sent to, so changing the number after sending doesn't
  // leave a stale "enter code" step showing for a number that was never
  // actually messaged.
  const [otpSentForPhone, setOtpSentForPhone] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<OtpError | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [otpVerifiedPhone, setOtpVerifiedPhone] = useState<string | null>(null);
  // Resend cooldown for the "Resend in 0:24" countdown. `key` bumps on every
  // send so the countdown component remounts and restarts from `seconds`.
  const [resendCooldown, setResendCooldown] = useState<{ seconds: number; key: number } | null>(null);
  // Set when /api/register rejects Checkout because the verification went
  // stale (server allows 60 min) — changes the recap's notice wording.
  const [verificationExpired, setVerificationExpired] = useState(false);

  const draftCategory = useMemo(
    () => categories.find((c) => c.id === draftCategoryId) ?? null,
    [categories, draftCategoryId]
  );

  // While editing an already-saved attendee, restrict category switching to
  // the same group (competitive <-> competitive, non-competitive <->
  // non-competitive) — a prize-eligible entrant can't quietly downgrade to
  // fun-run pricing or vice versa via the edit form. Looked up from the
  // saved attendee (not draftCategoryId, which changes as the user picks
  // within the group), so it stays fixed for the whole edit session.
  const lockedGroup: TicketGroup | null =
    editingIndex !== null
      ? categories.find((c) => c.id === attendees[editingIndex].categoryId)?.group ?? null
      : null;

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
  const childAmount = childCategory ? Number(childCategory.price_inr) : 0;
  const projectedTotal = otherTotal + draftTotal + (childRunner ? childAmount : 0);
  const projectedCount = otherAttendees.length + (draftCategory ? 1 : 0) + (childRunner ? 1 : 0);
  // T-shirt tally for the "So Far" summary — the same saved attendees the
  // summary lists (Child Runner gets no T-shirt), in size-chart order.
  const tshirtCounts = tallyTshirtSizes(otherAttendees.map((a) => a.tshirtSize));

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
  // Mirrors "tshirtSize" the same way phoneValue mirrors "phone" — needed to
  // highlight the selected size card without react-hook-form's watch().
  const [tshirtSizeValue, setTshirtSizeValue] = useState("");
  // Only the very first attendee in the booking needs phone verification.
  const isPrimaryAttendee = editingIndex === 0 || (editingIndex === null && attendees.length === 0);
  const isPhoneVerified = Boolean(phoneValue) && phoneValue === otpVerifiedPhone;
  const showOtpCodeInput = Boolean(phoneValue) && phoneValue === otpSentForPhone && !isPhoneVerified;
  // The mandatory gate: while the primary attendee's number is unverified,
  // everything after the verification step (details, ticket, add-ons,
  // consent, Save) stays locked.
  const detailsLocked = showForm && isPrimaryAttendee && !isPhoneVerified;
  // Checkout's hard gate — attendees[0] must exist and match the verified phone.
  const primaryPhoneVerified = attendees.length > 0 && attendees[0].phone === otpVerifiedPhone;
  // 1 = Verify number, 2 = Details, 3 = Review & pay.
  const currentStep: 1 | 2 | 3 = detailsLocked
    ? 1
    : showForm || showChildForm
      ? 2
      : primaryPhoneVerified
        ? 3
        : 1;

  async function handleSendOtp() {
    if (!PHONE_REGEX.test(phoneValue)) {
      setOtpError({ message: "Enter a valid 10-digit mobile number." });
      return;
    }
    if (attendees.some((a, i) => i !== editingIndex && a.phone === phoneValue)) {
      setOtpError({ message: "This number is already used by another participant in this booking." });
      return;
    }
    const isResend = otpSentForPhone === phoneValue;
    setOtpError(null);
    setOtpNotice(null);
    setOtpSending(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (typeof json.retryAfterSeconds === "number") {
          setResendCooldown((prev) => ({ seconds: json.retryAfterSeconds, key: (prev?.key ?? 0) + 1 }));
        }
        setOtpError({ message: json.error ?? "Could not send the code. Please try again." });
        return;
      }
      setOtpCode("");
      setOtpSentForPhone(phoneValue);
      setResendCooldown((prev) => ({
        seconds: typeof json.resendAfterSeconds === "number" ? json.resendAfterSeconds : 30,
        key: (prev?.key ?? 0) + 1,
      }));
      if (isResend) setOtpNotice("New code sent on WhatsApp. Use the latest one.");
    } catch {
      setOtpError({ message: "Could not send the code. Check your internet connection and try again." });
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp(code: string) {
    if (!phoneValue || code.length !== 6 || otpVerifying) return;
    setOtpError(null);
    setOtpNotice(null);
    setOtpVerifying(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue, code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError({
          message: json.error ?? "That code doesn't match. Please try again.",
          attemptsLeft: typeof json.attemptsLeft === "number" ? json.attemptsLeft : undefined,
        });
        return;
      }
      setOtpVerifiedPhone(phoneValue);
      setVerificationExpired(false);
      setOtpSentForPhone(null);
      setOtpCode("");
      setResendCooldown(null);
    } catch {
      setOtpError({ message: "Could not check the code. Check your internet connection and try again." });
    } finally {
      setOtpVerifying(false);
    }
  }

  /** Digits only, max 6; a complete code (typed, pasted or autofilled) is checked straight away. */
  function handleOtpCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setOtpCode(digits);
    if (otpError) setOtpError(null);
    if (digits.length === 6 && digits !== otpCode) void handleVerifyOtp(digits);
  }

  /**
   * "Change" on the code-sent or verified step: back to the number field
   * (pre-filled with the current number), dropping any verification — the
   * form locks again until a number is verified.
   */
  function handleChangeNumber() {
    setOtpVerifiedPhone(null);
    setOtpSentForPhone(null);
    setOtpCode("");
    setOtpError(null);
    setOtpNotice(null);
    setResendCooldown(null);
  }

  // Scrolled into view whenever a fresh/edited draft form replaces what was
  // on screen (after "+ Add Participant" or clicking "Edit"), so the next
  // fields to fill are immediately visible instead of leaving the user
  // scrolled down near whatever button they just clicked.
  const formTopRef = useRef<HTMLDivElement>(null);
  function scrollToFormTop() {
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // scrollIntoView above only scrolls within this document, which does
    // nothing when embedded in an iframe sized to its content (no internal
    // scrollbar of its own) — ask the parent page to scroll to the iframe's
    // position instead. No-ops outside an iframe.
    if (typeof window !== "undefined" && window.self !== window.top) {
      window.parent.postMessage({ type: "tgcg:scrollToTop" }, "*");
    }
  }

  // Scrolled to via effect (rather than a direct call in these handlers,
  // like every other scrollToFormTop() call in this file) because these
  // two are reached through the summaryItems data structure passed down as
  // a prop, several layers from the JSX that actually renders the button —
  // React's ref-safety lint rule flags a ref read that far from the click
  // it's attached to, even though it only ever runs after the click.
  useEffect(() => {
    if (showChildForm) scrollToFormTop();
  }, [showChildForm]);

  function startAddChildRunner() {
    setChildNameDraft("");
    setChildConfirmDraft(false);
    setChildError(null);
    setShowChildForm(true);
  }

  function startEditChildRunner() {
    if (!childRunner) return;
    setChildNameDraft(childRunner.fullName);
    setChildConfirmDraft(childRunner.confirmedUnder12);
    setChildError(null);
    setShowChildForm(true);
  }

  function removeChildRunner() {
    setChildRunner(null);
  }

  function cancelChildForm() {
    setShowChildForm(false);
  }

  function handleSaveChildRunner() {
    const result = childRunnerSchema.safeParse({
      fullName: childNameDraft,
      confirmedUnder12: childConfirmDraft,
    });
    if (!result.success) {
      setChildError(result.error.issues[0]?.message ?? "Please check the details");
      return;
    }
    setChildError(null);
    setChildRunner(result.data);
    setShowChildForm(false);
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
    setGovtIdError(null);
    setCategoryError(null);
    setPhoneValue("");
    setTshirtSizeValue("");
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
    setTshirtSizeValue(item.tshirtSize);
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
    // Unreachable through the UI (Save isn't rendered while detailsLocked),
    // but keeps the gate from depending on markup alone.
    if (isPrimaryAttendee && data.phone !== otpVerifiedPhone) return null;
    // The ID photo is still being resized: saving now would drop it.
    if (govtIdBusy) return null;
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

  /** Shrinks a picked ID photo so the checkout request stays under Vercel's 4.5 MB limit. */
  async function handleGovtIdFile(file: File | null) {
    setGovtIdError(null);
    if (!file) {
      setDraftGovtIdFile(null);
      return;
    }
    setGovtIdBusy(true);
    const result = await prepareGovtIdFile(file);
    setGovtIdBusy(false);
    if (result.ok) {
      setDraftGovtIdFile(result.file);
    } else {
      setDraftGovtIdFile(null);
      setGovtIdError(result.error);
    }
  }

  /** Recap-only: no draft is on screen here, so this just checks out with whatever's already saved. */
  function handleCheckoutClick() {
    void proceedToCheckout(attendees);
  }

  async function proceedToCheckout(finalAttendees: AttendeeCartItem[]) {
    setServerError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();

      const payload = finalAttendees.map((item) => ({
        ...toPersonalFields(item),
        ticketCategoryId: item.categoryId,
        addonIds: item.addonIds,
      }));
      formData.set("attendees", JSON.stringify(payload));
      finalAttendees.forEach((item, i) => {
        if (item.govtIdFile) formData.set(`govtIdFile_${i}`, item.govtIdFile);
      });
      const idBytes = finalAttendees.reduce((sum, item) => sum + (item.govtIdFile?.size ?? 0), 0);
      if (idBytes > CHECKOUT_MAX_BYTES) {
        setServerError(
          "The ID files in this booking are too large to send together. Edit a participant and upload a smaller photo of their ID."
        );
        setSubmitting(false);
        return;
      }
      if (childRunner) {
        formData.set("childRunner", JSON.stringify(childRunner));
      }

      const res = await fetch("/api/register", { method: "POST", body: formData });
      // Not every failure is our JSON: Vercel answers an oversized body with a plain-text 413.
      const json = await res.json().catch(() => null);
      if (!json) {
        setServerError(
          res.status === 413
            ? "The uploaded ID file is too large. Edit the participant and upload a smaller photo of the ID."
            : `Something went wrong (error ${res.status}). Please try again.`
        );
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        if (json.code === "PHONE_NOT_VERIFIED") {
          // Server-side verification went stale — drop the client's verified
          // state so the recap's "Verify now" notice takes over.
          setOtpVerifiedPhone(null);
          setVerificationExpired(true);
          setServerError(null);
        } else {
          setServerError(json.error ?? "Something went wrong. Please try again.");
        }
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
        description: `${finalAttendees.length} attendee${finalAttendees.length === 1 ? "" : "s"} — ${eventShortName}`,
        order_id: json.orderId,
        prefill: {
          name: finalAttendees[0]?.fullName,
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

  const summaryItems: SummaryItem[] = otherAttendees.map((a, i) => {
    const originalIndex = attendees.indexOf(a);
    return {
      label: `${a.fullName} — ${categories.find((c) => c.id === a.categoryId)?.name ?? ""}`,
      amount: attendeeTotal(a),
      onEdit: () => startEditAttendee(originalIndex),
      onRemove: () => removeAttendee(originalIndex),
      key: a.clientKey ?? i,
      bookingContact:
        originalIndex === 0 ? (a.phone === otpVerifiedPhone ? "verified" : "unverified") : undefined,
    };
  });
  if (childRunner) {
    summaryItems.push({
      label: `${childRunner.fullName} — Child Runner (Below 12)`,
      amount: childAmount,
      onEdit: () => startEditChildRunner(),
      onRemove: () => removeChildRunner(),
      key: "child-runner",
    });
  }

  return (
    <div className="mt-6">
      <AttendeeStep
        categories={categories}
        addons={addons}
        draftCategoryId={draftCategoryId}
        draftCategory={draftCategory}
        categoryError={categoryError}
        lockedGroup={lockedGroup}
        openGroups={openGroups}
        onToggleGroup={toggleGroup}
        onSelectCategory={(id) => {
          setDraftCategoryId(id);
          if (id) setCategoryError(null);
        }}
        addonIds={draftAddonIds}
        onToggleAddon={toggleDraftAddon}
        govtIdFile={draftGovtIdFile}
        onGovtIdFile={handleGovtIdFile}
        govtIdBusy={govtIdBusy}
        govtIdError={govtIdError}
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
        onPhoneChange={setPhoneValue}
        tshirtSizeValue={tshirtSizeValue}
        onTshirtSizeChange={setTshirtSizeValue}
        currentStep={currentStep}
        detailsLocked={detailsLocked}
        lockedNoticeExpanded={editingIndex === null && !showOtpCodeInput}
        verificationCard={
          isPrimaryAttendee ? (
            <PhoneVerificationStep
              register={register}
              phoneError={errors.phone?.message}
              phoneValue={phoneValue}
              onPhoneChange={setPhoneValue}
              isVerified={isPhoneVerified}
              showCodeInput={showOtpCodeInput}
              code={otpCode}
              onCodeChange={handleOtpCodeChange}
              sending={otpSending}
              verifying={otpVerifying}
              error={otpError}
              notice={otpNotice}
              resendCooldown={resendCooldown}
              onSend={() => void handleSendOtp()}
              onVerify={() => void handleVerifyOtp(otpCode)}
              onChangeNumber={handleChangeNumber}
              onCancel={attendees.length > 0 ? cancelDraft : undefined}
            />
          ) : null
        }
        primaryPhoneVerified={primaryPhoneVerified}
        primaryPhone={attendees[0]?.phone ?? null}
        primaryName={attendees[0]?.fullName ?? null}
        verificationExpired={verificationExpired}
        onVerifyPrimary={() => startEditAttendee(0)}
        serverError={serverError}
        summaryTitle={summaryItems.length > 0 ? "So Far" : "Summary"}
        summaryItems={summaryItems}
        tshirtCounts={tshirtCounts}
        projectedTotal={projectedTotal}
        projectedCount={projectedCount}
        checkoutLabel={submitting ? "Processing..." : `Checkout — Pay ₹${projectedTotal.toLocaleString("en-IN")}`}
        childCategory={childCategory}
        childRunner={childRunner}
        showChildForm={showChildForm}
        childNameDraft={childNameDraft}
        onChildNameChange={setChildNameDraft}
        childConfirmDraft={childConfirmDraft}
        onChildConfirmChange={setChildConfirmDraft}
        childError={childError}
        onAddChildRunner={startAddChildRunner}
        onSaveChildRunner={handleSaveChildRunner}
        onCancelChildForm={cancelChildForm}
      />
    </div>
  );
}

function AttendeeStep({
  categories,
  addons,
  draftCategoryId,
  draftCategory,
  categoryError,
  lockedGroup,
  openGroups,
  onToggleGroup,
  onSelectCategory,
  addonIds,
  onToggleAddon,
  govtIdFile,
  onGovtIdFile,
  govtIdBusy,
  govtIdError,
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
  onPhoneChange,
  tshirtSizeValue,
  onTshirtSizeChange,
  currentStep,
  detailsLocked,
  lockedNoticeExpanded,
  verificationCard,
  primaryPhoneVerified,
  primaryPhone,
  primaryName,
  verificationExpired,
  onVerifyPrimary,
  serverError,
  summaryTitle,
  summaryItems,
  tshirtCounts,
  projectedTotal,
  projectedCount,
  checkoutLabel,
  childCategory,
  childRunner,
  showChildForm,
  childNameDraft,
  onChildNameChange,
  childConfirmDraft,
  onChildConfirmChange,
  childError,
  onAddChildRunner,
  onSaveChildRunner,
  onCancelChildForm,
}: {
  categories: TicketCategory[];
  addons: Addon[];
  draftCategoryId: string | null;
  draftCategory: TicketCategory | null;
  categoryError: string | null;
  lockedGroup: TicketGroup | null;
  openGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onSelectCategory: (id: string | null) => void;
  addonIds: string[];
  onToggleAddon: (id: string) => void;
  govtIdFile: File | null;
  onGovtIdFile: (file: File | null) => void;
  govtIdBusy: boolean;
  govtIdError: string | null;
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
  onPhoneChange: (value: string) => void;
  tshirtSizeValue: string;
  onTshirtSizeChange: (value: string) => void;
  currentStep: 1 | 2 | 3;
  /** The primary attendee's number isn't verified yet — everything after the verification step is locked. */
  detailsLocked: boolean;
  /** Show the full locked-steps notice (section chips + group hint) rather than the compact one. */
  lockedNoticeExpanded: boolean;
  /** The verification step (primary attendee only), rendered above the attendee details; null otherwise. */
  verificationCard: ReactNode;
  /** Checkout's hard gate — the first attendee's phone must be verified. */
  primaryPhoneVerified: boolean;
  primaryPhone: string | null;
  primaryName: string | null;
  verificationExpired: boolean;
  onVerifyPrimary: () => void;
  serverError: string | null;
  summaryTitle: string;
  summaryItems: SummaryItem[];
  tshirtCounts: { size: string; count: number }[];
  projectedTotal: number;
  projectedCount: number;
  checkoutLabel: string;
  childCategory: TicketCategory | null;
  childRunner: ChildRunnerInput | null;
  showChildForm: boolean;
  childNameDraft: string;
  onChildNameChange: (value: string) => void;
  childConfirmDraft: boolean;
  onChildConfirmChange: (value: boolean) => void;
  childError: string | null;
  onAddChildRunner: () => void;
  onSaveChildRunner: () => void;
  onCancelChildForm: () => void;
}) {
  return (
    <div>
      {/*
        onSubmit is a no-op: every action here is a type="button" click, but
        on the verification step the phone field can be the form's only
        text input, where pressing Enter would otherwise trigger implicit
        submission and reload the page.
      */}
      <form className="mx-auto max-w-xl space-y-6" onSubmit={(e) => e.preventDefault()}>
        <div ref={formTopRef} className="scroll-mt-6" />

        <StepIndicator current={currentStep} />

        {summaryItems.length > 0 && (
          <SummaryCard
            title={summaryTitle}
            items={summaryItems}
            tshirtCounts={tshirtCounts}
            total={projectedTotal}
            itemCount={projectedCount}
          />
        )}

        {showForm && verificationCard}

        {showForm && detailsLocked && (
          <LockedStepsNotice expanded={lockedNoticeExpanded} hasAddons={addons.length > 0} />
        )}

        {showForm && !detailsLocked && (
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
          {/*
            The primary attendee's number lives in the verification step
            above (already verified by the time this card shows); every
            other attendee enters theirs here, unverified.
          */}
          {!isPrimaryAttendee && (
            <Field label="WhatsApp Contact Number" required error={errors.phone?.message}>
              <input
                {...register("phone", { onChange: (e) => onPhoneChange(e.target.value) })}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                className={inputClass}
              />
            </Field>
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
            <SizePicker
              register={register}
              value={tshirtSizeValue}
              onChange={onTshirtSizeChange}
            />
          </Field>
          <Field label="Emergency Contact Number" required error={errors.emergencyPhone?.message}>
            <input {...register("emergencyPhone")} placeholder="10-digit mobile number" className={inputClass} />
          </Field>
        </FormCard>

        <FormCard title="Select Ticket">
          {lockedGroup && (
            <p className="pb-2 text-xs text-[#6b7280]">
              You can only switch to another{" "}
              {lockedGroup === "competitive" ? "competitive" : "non-competitive"} category.
            </p>
          )}
          <TicketAccordion
            categories={categories}
            categoryId={draftCategoryId}
            lockedGroup={lockedGroup}
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
                {govtIdBusy ? "Preparing photo…" : govtIdFile ? govtIdFile.name : "Upload File"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  disabled={govtIdBusy}
                  onChange={(e) => {
                    void onGovtIdFile(e.target.files?.[0] ?? null);
                    // Lets the same file be picked again after an error.
                    e.target.value = "";
                  }}
                />
              </label>
              {govtIdError && <p className={errorClass}>{govtIdError}</p>}
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

        {!showForm && !showChildForm && (
          <>
            {serverError && (
              <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</p>
            )}

            {!primaryPhoneVerified && primaryPhone !== null && (
              <div role="alert" className="rounded-md border border-[#fcd34d] bg-[#fffbeb] px-4 py-3">
                <p className="text-sm font-bold text-[#92400e]">
                  {verificationExpired
                    ? "Your WhatsApp verification has expired"
                    : "WhatsApp verification needed"}
                </p>
                <p className="mt-0.5 text-sm text-[#92400e]">
                  Verify the booking contact&apos;s number
                  {primaryName ? ` (${primaryName}${primaryPhone ? `, ${formatPhone(primaryPhone)}` : ""})` : ""}{" "}
                  to check out.
                </p>
                <button
                  type="button"
                  onClick={onVerifyPrimary}
                  className="mt-3 rounded-md px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  Verify now
                </button>
              </div>
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
              {childCategory && !childRunner && (
                <button
                  type="button"
                  onClick={onAddChildRunner}
                  className="flex-1 rounded-md border py-3.5 text-base font-semibold transition"
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  + Add Child Runner (₹{Number(childCategory.price_inr).toLocaleString("en-IN")})
                </button>
              )}
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
            {primaryPhoneVerified && primaryPhone && (
              <p className="flex items-center justify-center gap-1.5 text-[13px] text-[#4b5563]">
                <TickIcon size={14} color="#16a34a" />
                Booking confirmation goes to verified number {formatPhone(primaryPhone)}
              </p>
            )}
          </>
        )}

        {showChildForm && (
          <FormCard
            title={childRunner ? "Edit Child Runner" : "Add Child Runner"}
            icon={<PersonIcon />}
            action={
              <button
                type="button"
                onClick={onCancelChildForm}
                className="text-xs font-medium underline"
                style={{ color: ACCENT }}
              >
                Cancel
              </button>
            }
          >
            <p className="text-sm text-[#6b7280]">
              This ticket is for children accompanying a registered runner. It provides a non-timed
              bib and access to the holding area, allowing them to safely participate and enjoy the
              event experience.
            </p>
            <Field label="Child's Name" required>
              <input
                value={childNameDraft}
                onChange={(e) => onChildNameChange(e.target.value)}
                className={inputClass}
              />
            </Field>
            <label className="flex items-start gap-3 text-sm text-[#374151]">
              <input
                type="checkbox"
                checked={childConfirmDraft}
                onChange={(e) => onChildConfirmChange(e.target.checked)}
                className="mt-1"
                style={{ accentColor: ACCENT }}
              />
              I confirm this child is below 12 years of age
              {childCategory ? ` (₹${Number(childCategory.price_inr).toLocaleString("en-IN")} entry)` : ""}
            </label>
            {childError && <p className={errorClass}>{childError}</p>}
            <button
              type="button"
              onClick={onSaveChildRunner}
              className="w-full rounded-md py-3.5 text-base font-semibold text-white transition"
              style={{ backgroundColor: ACCENT }}
            >
              Save
            </button>
          </FormCard>
        )}
      </form>
    </div>
  );
}

type OtpError = { message: string; attemptsLeft?: number };

type SummaryItem = {
  label: string;
  amount: number;
  onEdit?: () => void;
  onRemove?: () => void;
  key?: string | number;
  /** Marks the booking's first attendee — the one whose WhatsApp number is verified. */
  bookingContact?: "verified" | "unverified";
};

/** "9876543210" → "+91 98765 43210" — easier to check at a glance than ten run-together digits. */
function formatPhone(phone: string): string {
  return phone.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : `+91 ${phone}`;
}

const STEPS = ["Verify number", "Details", "Review & pay"] as const;

/**
 * "1 Verify number — 2 Details — 3 Review & pay". Inline from `sm` up; on
 * phones each label sits under its number instead, since the inline row
 * needs ~380px and the form can be as narrow as ~290px inside the iframe on
 * a small phone.
 */
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Registration steps" className="flex items-start sm:items-center">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <Fragment key={label}>
            {i > 0 && (
              <li
                aria-hidden="true"
                className="mx-1 mt-3 min-w-2 flex-1 sm:mx-2 sm:mt-0"
                style={{ backgroundColor: step <= current ? "#16a34a" : "#d1d5db", height: step <= current ? 2 : 1 }}
              />
            )}
            <li
              aria-current={active ? "step" : undefined}
              className="flex w-[84px] shrink-0 flex-col items-center gap-1 text-center sm:w-auto sm:flex-row sm:gap-1.5"
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                style={
                  done
                    ? { backgroundColor: "#16a34a", color: "#ffffff" }
                    : active
                      ? { backgroundColor: ACCENT, color: "#ffffff" }
                      : { border: "1px solid #9ca3af", color: "#6b7280" }
                }
              >
                {done ? <TickIcon size={14} label="Done" /> : step}
              </span>
              <span
                className={`text-xs leading-tight sm:text-[13px] ${active ? "font-bold" : ""}`}
                style={{ color: done ? "#166534" : active ? "#111827" : "#6b7280" }}
              >
                {label}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/**
 * Step 1 of the primary attendee's form — the mandatory WhatsApp OTP gate.
 * Three states: enter number → enter code → verified (a compact green bar).
 * The number input is react-hook-form's "phone" field; it unmounts in the
 * later two states but its value stays in the form (shouldUnregister is
 * off), and remounts pre-filled on "Change".
 */
function PhoneVerificationStep({
  register,
  phoneError,
  phoneValue,
  onPhoneChange,
  isVerified,
  showCodeInput,
  code,
  onCodeChange,
  sending,
  verifying,
  error,
  notice,
  resendCooldown,
  onSend,
  onVerify,
  onChangeNumber,
  onCancel,
}: {
  register: UseFormRegister<AttendeeFieldsInput>;
  phoneError?: string;
  phoneValue: string;
  onPhoneChange: (value: string) => void;
  isVerified: boolean;
  showCodeInput: boolean;
  code: string;
  onCodeChange: (raw: string) => void;
  sending: boolean;
  verifying: boolean;
  error: OtpError | null;
  notice: string | null;
  resendCooldown: { seconds: number; key: number } | null;
  onSend: () => void;
  onVerify: () => void;
  onChangeNumber: () => void;
  /** Back to the saved-attendees recap; only offered when there is one. */
  onCancel?: () => void;
}) {
  if (isVerified) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-md border border-[#86efac] bg-[#f0fdf4] px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white">
          <TickIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#166534]">WhatsApp number verified</p>
          <p className="text-[15px] font-semibold tracking-wide text-[#111827]">{formatPhone(phoneValue)}</p>
        </div>
        <button
          type="button"
          onClick={onChangeNumber}
          className="py-2 text-sm font-semibold underline"
          style={{ color: ACCENT }}
        >
          Change
        </button>
      </div>
    );
  }

  const errorId = "otp-error";

  return (
    <FormCard
      title="Verify your WhatsApp number"
      icon={<WhatsAppIcon size={18} />}
      action={
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-medium underline"
              style={{ color: ACCENT }}
            >
              Cancel
            </button>
          )}
          {/* Dropped on phones when Cancel is shown — the three don't fit on one line there. */}
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
              onCancel ? "hidden sm:inline-block" : ""
            }`}
            style={{ color: ACCENT, backgroundColor: "#efeaf8" }}
          >
            Required
          </span>
        </div>
      }
    >
      {!showCodeInput ? (
        <>
          <p className="text-[15px] leading-relaxed text-[#374151]">
            To register, first confirm the WhatsApp number of the person making this booking.
            We&apos;ll send a <strong className="text-[#111827]">6-digit code</strong> to it on WhatsApp.
          </p>

          <div>
            <label htmlFor="booking-phone" className="mb-1.5 block text-sm font-semibold text-[#374151]">
              WhatsApp number <span className="text-red-600">*</span>
            </label>
            <div
              className={`flex h-12 overflow-hidden rounded-lg border-[1.5px] bg-white ${
                phoneError ? "border-red-600" : "border-[#d1d5db] focus-within:border-[#5b3fa0]"
              }`}
            >
              <span className="flex items-center border-r border-[#e5e7eb] bg-[#f9fafb] px-3 text-base font-semibold text-[#374151]">
                +91
              </span>
              <input
                id="booking-phone"
                {...register("phone", { onChange: (e) => onPhoneChange(e.target.value) })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                autoComplete="tel-national"
                aria-invalid={phoneError ? true : undefined}
                className="min-w-0 flex-1 border-0 bg-transparent px-3 text-[17px] tracking-wide text-[#111827] outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-[#9ca3af]"
              />
            </div>
            {phoneError ? (
              <p className={errorClass}>{phoneError}</p>
            ) : (
              <p className="mt-1.5 text-[13px] text-[#6b7280]">
                Your booking confirmation will also be sent to this number.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {sending ? (
              "Sending code..."
            ) : (
              <>
                <WhatsAppIcon size={18} color="#ffffff" /> Send code on WhatsApp
              </>
            )}
          </button>

          {error && <OtpErrorBox id={errorId} error={error} />}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-3">
            <WhatsAppIcon size={22} color="#16a34a" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-[#166534]">Code sent on WhatsApp to</p>
              <p className="text-[17px] font-bold tracking-wide text-[#111827]">{formatPhone(phoneValue)}</p>
            </div>
            <button
              type="button"
              onClick={onChangeNumber}
              className="py-2 text-sm font-semibold underline"
              style={{ color: ACCENT }}
            >
              Change
            </button>
          </div>

          <div>
            <label htmlFor="otp-code" className="mb-2 block text-sm font-semibold text-[#374151]">
              Enter the 6-digit code <span className="text-red-600">*</span>
            </label>
            <OtpCodeInput
              id="otp-code"
              value={code}
              onChange={onCodeChange}
              invalid={Boolean(error)}
              describedBy={error ? errorId : undefined}
              onEnter={onVerify}
            />
          </div>

          {error && <OtpErrorBox id={errorId} error={error} />}
          {notice && !error && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-[#166534]">
              <TickIcon size={14} color="#16a34a" /> {notice}
            </p>
          )}

          <button
            type="button"
            onClick={onVerify}
            disabled={verifying || code.length !== 6}
            className="h-12 w-full rounded-lg text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {verifying ? "Verifying..." : "Verify & continue"}
          </button>

          <ResendCodeButton
            key={resendCooldown?.key ?? 0}
            cooldownSeconds={resendCooldown?.seconds ?? 0}
            sending={sending}
            onResend={onSend}
          />

          <ul className="list-disc space-y-1.5 rounded-lg bg-[#f9fafb] py-3 pl-8 pr-3.5 text-[13px] leading-snug text-[#374151]">
            <li>
              Open WhatsApp on the phone that uses <strong>{formatPhone(phoneValue)}</strong>. The code
              arrives as a message.
            </li>
            <li>
              The code is valid for <strong>10 minutes</strong>.
            </li>
            <li>
              Asked for more than one code? Use the <strong>latest</strong> one.
            </li>
          </ul>
        </>
      )}
    </FormCard>
  );
}

/**
 * Six digit boxes backed by ONE real input laid invisibly on top — so
 * paste, SMS/WhatsApp autofill (autocomplete="one-time-code") and
 * backspace all behave like a normal text field, while the boxes make each
 * digit easy to read and check.
 */
function OtpCodeInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  onEnter,
}: {
  id: string;
  value: string;
  onChange: (raw: string) => void;
  invalid: boolean;
  describedBy?: string;
  onEnter: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, 5);

  return (
    <div className="relative max-w-[304px]">
      <div aria-hidden="true" className="flex gap-2">
        {Array.from({ length: 6 }, (_, i) => {
          const digit = value[i] ?? "";
          const active = focused && i === activeIndex;
          return (
            <span
              key={i}
              className="flex h-[52px] max-w-11 flex-1 items-center justify-center rounded-lg text-[22px] font-semibold text-[#111827]"
              style={{
                border: `${active ? 2 : 1.5}px solid ${
                  invalid ? "#dc2626" : active ? ACCENT : digit ? "#9ca3af" : "#d1d5db"
                }`,
                backgroundColor: invalid ? "#fef2f2" : "#ffffff",
              }}
            >
              {digit}
            </span>
          );
        })}
      </div>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="absolute inset-0 h-full w-full cursor-text text-base opacity-0"
      />
    </div>
  );
}

/**
 * "Didn't get the code? Resend in 0:24" — counts down from
 * `cooldownSeconds` (the server's resend cooldown) and then enables. The
 * parent remounts it via `key` on every send, which restarts the count.
 */
function ResendCodeButton({
  cooldownSeconds,
  sending,
  onResend,
}: {
  cooldownSeconds: number;
  sending: boolean;
  onResend: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const endsAt = Date.now() + cooldownSeconds * 1000;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [cooldownSeconds]);

  const waiting = secondsLeft > 0;
  const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="flex items-center justify-center gap-1.5 text-sm text-[#4b5563]">
      <span>Didn&apos;t get the code?</span>
      <button
        type="button"
        onClick={onResend}
        disabled={waiting || sending}
        className={`py-2 text-sm font-semibold ${waiting || sending ? "cursor-not-allowed text-[#6b7280]" : "underline"}`}
        style={waiting || sending ? undefined : { color: ACCENT }}
      >
        {sending ? "Sending..." : waiting ? `Resend in ${countdown}` : "Resend code"}
      </button>
    </div>
  );
}

function OtpErrorBox({ id, error }: { id: string; error: OtpError }) {
  const attemptsLeft = error.attemptsLeft;
  return (
    <div id={id} role="alert" className="flex items-start gap-2.5 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3">
      <AlertIcon />
      <p className="text-sm leading-snug text-[#991b1b]">
        {error.message}
        {attemptsLeft !== undefined && attemptsLeft > 0 && (
          <>
            {" "}
            <strong>
              {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} left.
            </strong>
          </>
        )}
      </p>
    </div>
  );
}

/** Stands in for the rest of the primary attendee's form until their number is verified. */
function LockedStepsNotice({ expanded, hasAddons }: { expanded: boolean; hasAddons: boolean }) {
  const sections = ["Attendee details", "Select ticket", ...(hasAddons ? ["Add-ons"] : []), "Consent"];
  return (
    <>
      <section
        aria-label="Locked until your number is verified"
        className="rounded-md border-[1.5px] border-dashed border-[#d1d5db] bg-[#f9fafb] p-4"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb] text-[#4b5563]">
            <LockIcon />
          </span>
          <div>
            <p className="text-sm font-bold text-[#374151]">Next: participant details, ticket &amp; payment</p>
            <p className="text-[13px] text-[#6b7280]">These unlock once your number is verified.</p>
          </div>
        </div>
        {expanded && (
          <div className="mt-3 flex flex-wrap gap-1.5 pl-12">
            {sections.map((s) => (
              <span
                key={s}
                className="rounded-full border border-[#e5e7eb] bg-white px-2.5 py-0.5 text-xs text-[#4b5563]"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </section>
      {expanded && (
        <p className="flex gap-2 text-[13px] leading-relaxed text-[#4b5563]">
          <InfoIcon />
          <span>
            Registering a group? Only the first participant verifies. You can add the others after
            this step.
          </span>
        </p>
      )}
    </>
  );
}

function TicketAccordion({
  categories,
  categoryId,
  lockedGroup,
  openGroups,
  onToggleGroup,
  onSelectCategory,
}: {
  categories: TicketCategory[];
  categoryId: string | null;
  lockedGroup: TicketGroup | null;
  openGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onSelectCategory: (id: string | null) => void;
}) {
  const allGroups: { key: TicketGroup; label: string }[] = [
    { key: "competitive", label: "All Competitive Tickets (नकद पुरस्कार श्रेणी)" },
    { key: "non_competitive", label: "All Non Competitive Tickets" },
  ];
  const groups = lockedGroup ? allGroups.filter((g) => g.key === lockedGroup) : allGroups;

  return (
    <div className="border-t border-[#e5e7eb]">
      {groups.map(({ key, label }) => {
        const group = categories.filter((c) => c.group === key);
        if (group.length === 0) return null;
        const open = lockedGroup ? true : openGroups[key];
        return (
          <div key={key} className="border-b border-[#e5e7eb]">
            <button
              type="button"
              onClick={() => onToggleGroup(key)}
              disabled={Boolean(lockedGroup)}
              className="flex w-full items-center gap-3 py-4 text-left disabled:cursor-default"
            >
              {!lockedGroup && (
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}
                >
                  {open ? "−" : "+"}
                </span>
              )}
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
                          <span
                            className="mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                            style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}
                          >
                            Age Eligibility: {c.min_age} years &amp; above
                          </span>
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

/** Counts per T-shirt size, ordered like the size chart (any unknown size last). */
function tallyTshirtSizes(sizes: (string | null | undefined)[]): { size: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const size of sizes) {
    if (size) counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  const order = TSHIRT_SIZE_CHART.map((row) => row.size);
  const rank = (size: string) => (order.includes(size) ? order.indexOf(size) : order.length);
  return [...counts.entries()]
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => rank(a.size) - rank(b.size));
}

function SummaryCard({
  title = "Summary",
  items,
  tshirtCounts,
  total,
  itemCount,
}: {
  title?: string;
  items?: SummaryItem[];
  tshirtCounts?: { size: string; count: number }[];
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
                {item.bookingContact === "verified" && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5 text-xs font-semibold text-[#166534]">
                    <TickIcon size={12} /> Booking contact · WhatsApp verified
                  </span>
                )}
                {item.bookingContact === "unverified" && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#fcd34d] bg-[#fffbeb] px-2 py-0.5 text-xs font-semibold text-[#92400e]">
                    Booking contact · not verified
                  </span>
                )}
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

        {tshirtCounts && tshirtCounts.length > 0 && (
          <div className="mt-3 border-b border-[#e5e7eb] pb-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-[#6b7280]">
              <span>T-Shirts</span>
              <span>
                {tshirtCounts.reduce((sum, t) => sum + t.count, 0)} total
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tshirtCounts.map((t) => (
                <span
                  key={t.size}
                  className="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  {t.size} × {t.count}
                </span>
              ))}
            </div>
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

/**
 * A dropdown that opens onto the chest/length chart directly, instead of a
 * plain list of size names — the measurements are the deciding factor, so
 * putting them right on the option removes a step (no separate "Size guide"
 * lookup). Backed by a real (visually hidden) radio per size so
 * react-hook-form's register() wires it up exactly like the Gender radios
 * above; `value` is the parent's mirrored form state (see phoneValue for why
 * this file avoids watch()), used only to show the current selection.
 */
function SizePicker({
  register,
  value,
  onChange,
}: {
  register: UseFormRegister<AttendeeFieldsInput>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = TSHIRT_SIZE_CHART.find((row) => row.size === value) ?? null;

  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className={selected ? undefined : "text-[#9ca3af]"}>
          {selected ? `${selected.size} — Chest ${selected.chest}″, Length ${selected.length}″` : "Select size"}
        </span>
        <ChevronDownIcon open={open} />
      </button>

      {/*
        Rendered in normal flow (not an absolute/floating overlay) because
        FormCard clips overflow for its rounded corners — an overlay here
        would get cut off instead of floating above the rest of the form.
      */}
      {open && (
        <div
          className="mt-1 max-h-72 overflow-y-auto rounded-lg border bg-white shadow-sm"
          style={{ borderColor: "#e5e7eb" }}
        >
          <p className="border-b px-3 py-2 text-xs text-[#6b7280]" style={{ borderColor: "#f3f4f6" }}>
            Approximate measurements in inches — if you&apos;re between sizes, we recommend sizing up.
          </p>
          {TSHIRT_SIZE_CHART.map((row) => {
            const isSelected = value === row.size;
            return (
              <label
                key={row.size}
                className="flex cursor-pointer items-center justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                style={{
                  borderColor: "#f3f4f6",
                  backgroundColor: isSelected ? `${ACCENT}1a` : "transparent",
                }}
              >
                <input
                  type="radio"
                  value={row.size}
                  {...register("tshirtSize", {
                    onChange: (e) => {
                      onChange(e.target.value);
                      setOpen(false);
                    },
                  })}
                  className="sr-only"
                />
                <span className="font-semibold" style={{ color: isSelected ? ACCENT : "#111827" }}>
                  {row.size}
                </span>
                <span className="text-xs text-[#6b7280]">
                  Chest {row.chest}&Prime; &middot; Length {row.length}&Prime;
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="shrink-0 transition-transform"
      style={{ transform: open ? "rotate(180deg)" : undefined, color: "#6b7280" }}
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Check mark in currentColor (or `color`). Decorative unless given a `label`. */
function TickIcon({ size = 16, color, label }: { size?: number; color?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

function WhatsAppIcon({ size = 16, color = "#25D366" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" className="shrink-0">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.35 5.07L2 22l5.06-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Zm0 18.1c-1.62 0-3.14-.44-4.44-1.2l-.32-.19-3.16.83.84-3.09-.2-.32A8.09 8.09 0 0 1 3.9 12c0-4.47 3.63-8.1 8.1-8.1s8.1 3.63 8.1 8.1-3.63 8.1-8.1 8.1Zm4.46-6.07c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.78.95-.14.16-.29.18-.53.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.35-1.67-.14-.24-.02-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.42-.55-.42-.14-.01-.3-.01-.47-.01-.16 0-.42.06-.65.3-.22.24-.85.83-.85 2.03s.87 2.36 1 2.52c.12.16 1.71 2.61 4.15 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z" />
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
