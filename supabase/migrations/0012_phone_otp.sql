-- Phone-OTP verification for the primary (first) attendee in a booking.
-- Checkout is hard-gated on this: /api/register independently re-checks a
-- verified, unexpired row exists for attendees[0]'s phone — the client-side
-- gate is just UX, never the source of truth.
--
-- This happens before any registrations/registration_groups row exists (the
-- organizer hasn't paid or even submitted yet), so it's its own standalone
-- table rather than a column on registrations. code_hash stores a SHA-256
-- hash of the 6-digit code, never the plaintext.

create table phone_otp_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  phone_country_code text not null default '+91',
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count int not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Looked up as "most recent row for this phone" by both /api/otp/send
-- (resend cooldown) and /api/otp/verify (which code is current).
create index on phone_otp_verifications (phone, created_at desc);

alter table phone_otp_verifications enable row level security;
-- No anon/authenticated policies — service role only, matching every other PII table.
