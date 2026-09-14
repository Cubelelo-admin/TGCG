-- Group registrations: one Google-verified organizer registers 1..10
-- attendees in one sitting, paying once via a single Razorpay order shared
-- across all their `registrations` rows.
--
-- payment_status/amount_inr/razorpay_order_id stay on `registrations` itself
-- (per attendee), not moved to the group table, so the existing row-level
-- triggers (sync_sold_counts in 0004, set_registration_code in 0008) need no
-- changes: an UPDATE flipping N rows to 'paid' in one statement still fires
-- each trigger once per row, correctly, exactly as it does today.

create table registration_groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),

  -- The Google-verified person who ran the checkout (not necessarily one of
  -- the attendees themselves).
  organizer_full_name text,
  organizer_email text not null,
  organizer_google_sub text,

  attendee_count int not null default 1,
  amount_total_inr numeric(10, 2),

  created_at timestamptz not null default now()
);

create index on registration_groups (event_id);

alter table registrations
  add column if not exists group_id uuid references registration_groups(id) on delete set null;

create index if not exists registrations_group_id_idx on registrations (group_id);

-- A group's N attendee rows now intentionally share one Razorpay order id.
-- Razorpay order ids are already globally unique upstream.
alter table registrations drop constraint if exists registrations_razorpay_order_id_key;
create index if not exists registrations_razorpay_order_id_idx on registrations (razorpay_order_id);

-- Lets a wa_message_log row represent a group-level send (the organizer's
-- one summary email) as well as today's per-attendee sends.
alter table wa_message_log
  add column if not exists group_id uuid references registration_groups(id) on delete set null;

alter table registration_groups enable row level security;
-- No anon/authenticated policies — service role only, matching every other PII table.
