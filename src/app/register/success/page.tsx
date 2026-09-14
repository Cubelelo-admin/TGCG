import QRCode from "qrcode";
import { createServiceClient } from "@/lib/supabase/server";

const ACCENT = "#5b3fa0";

export default async function RegisterSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group: groupId } = await searchParams;
  const group = groupId ? await getGroupSummary(groupId) : null;

  const allPaid = group ? group.attendees.every((a) => a.payment_status === "paid") : false;

  return (
    <main className="min-h-screen flex-1 bg-white px-6 py-16">
      <div className="mx-auto max-w-lg">
        {group && allPaid ? (
          <GroupTicket group={group} />
        ) : group ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#111827]">Payment processing</h1>
            <p className="mt-2 text-[#6b7280]">
              We&apos;re confirming your payment for {group.attendees.length} attendee
              {group.attendees.length === 1 ? "" : "s"} — this can take a minute. If your
              payment was deducted, your spot is secured; refresh this page shortly
              or check your email.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#111827]">Registration not found</h1>
            <p className="mt-2 text-[#6b7280]">
              If you completed a payment, check your email for confirmation.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

async function GroupTicket({ group }: { group: GroupSummary }) {
  const total = group.attendees.reduce((sum, a) => sum + Number(a.amount_inr), 0);
  const tickets = await Promise.all(
    group.attendees.map(async (attendee) => ({
      attendee,
      qrDataUrl: attendee.registration_code
        ? await QRCode.toDataURL(attendee.registration_code, {
            margin: 1,
            width: 220,
            color: { dark: "#111827", light: "#ffffff" },
          })
        : null,
    }))
  );

  return (
    <div className="text-center">
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}
      >
        <CheckIcon />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-[#111827]">You&apos;re registered!</h1>
      <p className="mt-2 text-[#6b7280]">
        {group.attendees.length} attendee{group.attendees.length === 1 ? "" : "s"} · ₹
        {total.toLocaleString("en-IN")}
      </p>

      <div className="mt-8 space-y-4">
        {tickets.map(({ attendee, qrDataUrl }) => (
          <div
            key={attendee.registration_code ?? attendee.full_name}
            className="flex items-center gap-5 rounded-md border border-[#e5e7eb] p-5 text-left"
          >
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Registration QR code" className="h-28 w-28 shrink-0 rounded-sm" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[#9ca3af]">
                Registration ID
              </p>
              <p className="text-xl font-bold" style={{ color: ACCENT }}>
                {attendee.registration_code ?? "—"}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-[#111827]">
                {attendee.full_name}
              </p>
              <p className="text-sm text-[#6b7280]">{attendee.ticket_categories?.name}</p>
              <span className="mt-2 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                Confirmed
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm font-semibold text-[#111827]">
        Show the relevant QR code at the reception desk / BIB collection counter on race day.
      </p>
      <p className="mt-4 text-sm text-[#9ca3af]">
        A confirmation for each attendee has been sent via WhatsApp where possible; a
        summary has been emailed to {group.organizer_email}.
      </p>
    </div>
  );
}

type AttendeeSummary = {
  full_name: string;
  amount_inr: number;
  payment_status: string;
  registration_code: string | null;
  ticket_categories: { name: string } | null;
};

type GroupSummary = {
  organizer_email: string;
  attendees: AttendeeSummary[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getGroupSummary(groupParam: string): Promise<GroupSummary | null> {
  const supabase = createServiceClient();

  // The link in this URL comes from two sources: the browser redirects here
  // right after payment using the raw registration_groups.id (a uuid, known
  // before payment completes); the WhatsApp/email confirmations link here
  // using the friendlier booking_code (e.g. "TGCG-G-0007") assigned once
  // payment is confirmed. Match whichever shape was given rather than
  // querying a uuid column with a non-uuid literal (which Postgres rejects).
  const column = UUID_RE.test(groupParam) ? "id" : "booking_code";

  const { data: group } = await supabase
    .from("registration_groups")
    .select("id, organizer_email")
    .eq(column, groupParam)
    .maybeSingle();
  if (!group) return null;

  const { data: attendees } = await supabase
    .from("registrations")
    .select("full_name, amount_inr, payment_status, registration_code, ticket_categories(name)")
    .eq("group_id", group.id)
    .order("created_at", { ascending: true });

  return {
    organizer_email: group.organizer_email,
    attendees: (attendees ?? []) as unknown as AttendeeSummary[],
  };
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
