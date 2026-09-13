import { createServiceClient } from "@/lib/supabase/server";

const ACCENT = "#5b3fa0";

export default async function RegisterSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reg?: string }>;
}) {
  const { reg } = await searchParams;
  const registration = reg ? await getSummary(reg) : null;

  return (
    <main className="min-h-screen flex-1 bg-white px-6 py-24">
      <div className="mx-auto max-w-lg text-center">
        {registration?.payment_status === "paid" ? (
          <>
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}
            >
              <CheckIcon />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-[#111827]">You&apos;re registered!</h1>
            <p className="mt-2 text-[#6b7280]">
              {registration.ticket_categories?.name} · ₹
              {Number(registration.amount_inr).toLocaleString("en-IN")}
            </p>
            <p className="mt-4 text-sm text-[#9ca3af]">
              A confirmation has been sent to {registration.email} and via WhatsApp
              to your registered number.
            </p>
          </>
        ) : registration ? (
          <>
            <h1 className="text-2xl font-bold text-[#111827]">Payment processing</h1>
            <p className="mt-2 text-[#6b7280]">
              We&apos;re confirming your payment — this can take a minute. If your
              payment was deducted, your spot is secured; refresh this page shortly
              or check your email.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-[#111827]">Registration not found</h1>
            <p className="mt-2 text-[#6b7280]">
              If you completed a payment, check your email for confirmation.
            </p>
          </>
        )}
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
