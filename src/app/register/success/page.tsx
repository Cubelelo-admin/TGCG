import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";

export default async function RegisterSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reg?: string }>;
}) {
  const { reg } = await searchParams;
  const registration = reg ? await getSummary(reg) : null;

  return (
    <main className="flex-1 px-6 py-24">
      <div className="mx-auto max-w-lg text-center">
        {registration?.payment_status === "paid" ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2f6f6b]/15 text-[#2f6f6b]">
              <CheckIcon />
            </div>
            <h1 className="font-display mt-6 text-2xl uppercase tracking-[-0.01em]">You&apos;re registered!</h1>
            <p className="mt-2 text-[#6d6656]">
              {registration.ticket_categories?.name} · ₹
              {Number(registration.amount_inr).toLocaleString("en-IN")}
            </p>
            <p className="mt-4 text-sm text-[#6d6656]/80">
              A confirmation has been sent to {registration.email} and via WhatsApp
              to your registered number.
            </p>
          </>
        ) : registration ? (
          <>
            <h1 className="font-display text-2xl uppercase tracking-[-0.01em]">Payment processing</h1>
            <p className="mt-2 text-[#6d6656]">
              We&apos;re confirming your payment — this can take a minute. If your
              payment was deducted, your spot is secured; refresh this page shortly
              or check your email.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl uppercase tracking-[-0.01em]">Registration not found</h1>
            <p className="mt-2 text-[#6d6656]">
              If you completed a payment, check your email for confirmation.
            </p>
          </>
        )}

        <Link
          href="/"
          className="mt-10 inline-block rounded-full border border-[#17181a]/20 px-6 py-2.5 text-sm font-medium hover:border-[#17181a]/40"
        >
          Back to event page
        </Link>
      </div>
    </main>
  );
}

async function getSummary(registrationId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("registrations")
    .select("email, amount_inr, payment_status, ticket_categories(name)")
    .eq("id", registrationId)
    .maybeSingle();

  return data as
    | {
        email: string;
        amount_inr: number;
        payment_status: string;
        ticket_categories: { name: string } | null;
      }
    | null;
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
