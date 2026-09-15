import QRCode from "qrcode";
import { createServiceClient } from "@/lib/supabase/server";
import TicketView, { type TicketData } from "./TicketView";

const ACCENT = "#5b3fa0";
const EVENT_TITLE = "HIRA TGCG 2026";
const EVENT_DATE_LINE = "Sun, 20 Dec 2026 · CBD Square, Naya Raipur";

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
  const tickets: TicketData[] = await Promise.all(
    group.attendees
      .filter((a): a is AttendeeSummary & { registration_code: string } => Boolean(a.registration_code))
      .map(async (attendee) => ({
        fullName: attendee.full_name,
        categoryName: attendee.ticket_categories?.name ?? "TGCG 2026",
        registrationCode: attendee.registration_code,
        qrDataUrl: await QRCode.toDataURL(attendee.registration_code, {
          margin: 1,
          width: 220,
          color: { dark: "#111827", light: "#ffffff" },
        }),
      }))
  );

  return (
    <div>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="LetsRun" className="h-10 w-10 shrink-0 object-contain" />
        <div>
          <p className="text-base font-bold text-[#111827]">{EVENT_TITLE}</p>
          <p className="text-xs text-[#6b7280]">{EVENT_DATE_LINE}</p>
        </div>
      </div>

      <div className="mt-8 text-center">
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
      </div>

      <div className="mt-8">
        <TicketView tickets={tickets} />
      </div>

      <p className="mt-6 text-center text-sm font-semibold text-[#111827]">
        Show this at the time of BIB collection.
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
  organizer_email: string | null;
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
