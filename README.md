# TGCG — LetsRun TGCG 2026

Event registration site + organizer admin dashboard for LetsRun TGCG 2026
(20 Dec 2026, Ekatma Path Park, Raipur), replacing the Townscript listing.

- **Frontend**: public event page + ticket registration + Razorpay checkout
  (`/`, `/register`)
- **Backend**: Next.js Route Handlers + Supabase Postgres
- **Admin dashboard**: `/admin` (Supabase Auth, allowlisted emails only) —
  registrations table, CSV export, WhatsApp resend
- **Payments**: Razorpay Orders + webhook
- **WhatsApp**: AiSensy template messages on successful payment

One Next.js app, one Vercel deployment. Public routes and `/admin` share the
same domain; `/admin` is gated by Supabase Auth + an allowlist table.

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (or use an
   existing one).
2. Project Settings → API: copy the **Project URL**, **anon/public key**, and
   **service_role key**.
3. Run the schema: open the SQL Editor and run, in order, everything in
   `supabase/migrations/` (or paste `supabase/combined.sql` once — it's all
   five files concatenated). This creates all tables, RLS policies, the
   `govt-ids` private storage bucket, the sold-count trigger, and seeds the
   event/ticket catalog plus the admin allowlist.
4. Authentication → Users → Add user for each admin allowlisted in
   `admin_allowlist` (`letsrunteam@gmail.com`, `risewithharsh@gmail.com`), or
   have them sign up and you just need their email present in
   `admin_allowlist` (already seeded).
5. **Ticket catalog.** `0002_seed.sql` was verified 2026-09-12 directly
   against the live Townscript booking flow (7 categories: 3 competitive +
   4 non-competitive, all ₹1454/₹1205). The two add-ons ("Non Runner
   Friend", "Accompanying Child") aren't currently being sold on Townscript
   either, so they're seeded `is_active = false` — flip them on in
   `addons` if/when they're relisted.

## 2. Razorpay setup

1. Dashboard → Settings → API Keys → generate **Key Id** / **Key Secret**.
2. Dashboard → Settings → Webhooks → Add webhook:
   - URL: `https://<your-domain>/api/razorpay/webhook`
   - Active events: `payment.captured`, `payment.failed`
   - Copy the **webhook secret** shown there.
3. Start in **Test mode** to run a full dry-run registration with a
   [test card](https://razorpay.com/docs/payments/payments/test-card-upi-details/)
   before switching to live keys.

## 3. AiSensy setup

1. Create/confirm the WhatsApp template used for registration confirmations
   in the AiSensy dashboard (Campaigns), and note its exact **campaign
   name** and the order of its `{{1}}`, `{{2}}`, ... params — the app sends
   `[fullName, ticketCategoryName, amountInr]` as `templateParams`
   (`src/lib/notify.ts`) — adjust that array if your template's params
   differ.
2. Dashboard → Manage → API Key.

## 4. Email (Gmail SMTP) — confirmation backstop

Until AiSensy is live, registration confirmations go out by email via Gmail
SMTP so registrants get *something* immediately on payment.

1. Sign in to the sending Gmail account (e.g. `letsrunteam@gmail.com`) and
   enable 2-Step Verification if it isn't already on.
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
   create an app password (any name, e.g. "TGCG Registration").
3. Set `GMAIL_USER` to that Gmail address and `GMAIL_APP_PASSWORD` to the
   16-character app password (not the regular account password).

Gmail's ordinary sending limit (~500/day) is well above what this event
needs; once AiSensy is live both channels fire independently on every paid
registration (`src/lib/notify.ts`) and each attempt is logged in
`wa_message_log` (with a `channel` column: `whatsapp` or `email`).

## 5. Environment variables

Copy `.env.example` to `.env.local` and fill in the values from steps 1–4:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
AISENSY_API_KEY=
AISENSY_REGISTRATION_CAMPAIGN=
GMAIL_USER=
GMAIL_APP_PASSWORD=
NEXT_PUBLIC_SITE_URL=
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security — it's only ever read
server-side (never sent to the browser) and must never be committed or
prefixed with `NEXT_PUBLIC_`.

## 6. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 7. Deploy to Vercel

Already deployed: **https://tgcg.vercel.app** (Vercel project `harsh-cubelelo/tgcg`,
linked via `.vercel/project.json`). Deployment protection (Vercel SSO) is
disabled on this project since it's a public site — don't re-enable it, or
the event page and registration flow become unreachable for everyone but
logged-in Vercel team members.

To redeploy after changes:

```bash
npx vercel deploy --prod
```

Env vars live in Vercel Project Settings → Environment Variables
(`vercel env add <NAME> production`, or `vercel env ls` to check what's set).
The Razorpay webhook (step 2) already points at
`https://tgcg.vercel.app/api/razorpay/webhook` — if a custom domain is added
later, update both the webhook URL there and `NEXT_PUBLIC_SITE_URL`.

## How registration + payment works

1. `/register` — user picks a ticket category (+ optional add-ons) and fills
   the attendee form (mirrors the old Townscript fields, including
   Aadhar/bank/PAN for competitive/cash-prize categories).
2. `POST /api/register` — validates input, **recomputes the price
   server-side from the DB** (never trusts a client-sent amount), creates a
   `pending` registration row, uploads the govt-ID file to the private
   `govt-ids` storage bucket if provided, and creates a Razorpay order.
3. Razorpay Checkout opens client-side. On success, the browser calls
   `POST /api/razorpay/verify`, which verifies the HMAC signature and marks
   the registration `paid`.
4. The Razorpay **webhook** (`/api/razorpay/webhook`) is the source of truth
   backstop — it independently verifies and marks payments `paid`/`failed`
   even if the browser tab closes before step 3 completes.
5. On the transition to `paid`, a DB trigger increments
   `ticket_categories.sold_count` / `addons.sold_count`, and confirmations
   fire on both WhatsApp (AiSensy) and email (Gmail SMTP) — each logged
   independently in `wa_message_log`.

## Admin dashboard

`/admin` — Supabase Auth login, restricted to emails present in the
`admin_allowlist` table. Shows registration stats, a filterable/searchable
registrations table, CSV export (full attendee + KYC data — handle the
exported file carefully), and a per-registration "Resend confirmation"
action (fires both WhatsApp and email again).

## Security notes

- All PII (registrations, KYC, `wa_message_log`, `admin_allowlist`) has RLS
  enabled with **no** anon/authenticated policies — only the service-role
  client (server-side only) can read/write it. The public anon key can only
  read active `events` / `ticket_categories` / `addons` rows.
- Payment amounts are always computed server-side from the DB catalog, never
  trusted from the client, closing the obvious price-tampering hole.
- Razorpay payment verification and the webhook both use HMAC signature
  checks with `crypto.timingSafeEqual`.
