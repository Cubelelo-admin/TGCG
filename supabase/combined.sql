-- TGCG (LetsRun TGCG 2026) event registration schema
-- All PII-bearing tables have RLS enabled with NO public policies.
-- Every read/write of registrations happens through server-side routes using the
-- service role key (never exposed to the browser). The anon key is only used for
-- Supabase Auth (admin login) and reading public, non-sensitive catalog data.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  venue text,
  event_date date not null,
  starts_at_text text, -- e.g. "4:00 AM IST Onwards" (display only)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ticket_categories
-- ---------------------------------------------------------------------------
create type ticket_group as enum ('competitive', 'non_competitive');

create table ticket_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  "group" ticket_group not null,
  name text not null,
  unique (event_id, name),
  description text,
  price_inr numeric(10, 2) not null,
  min_age int,
  max_age int,
  capacity int, -- null = unlimited
  sold_count int not null default 0,
  requires_kyc boolean not null default true, -- Aadhar/bank/PAN for prize money
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index on ticket_categories (event_id);

-- ---------------------------------------------------------------------------
-- addons (Non-Runner Friend, Accompanying Child, etc.)
-- ---------------------------------------------------------------------------
create table addons (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  unique (event_id, name),
  description text,
  price_inr numeric(10, 2) not null,
  capacity int,
  sold_count int not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create index on addons (event_id);

-- ---------------------------------------------------------------------------
-- registrations
-- ---------------------------------------------------------------------------
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'cancelled');

create table registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  ticket_category_id uuid not null references ticket_categories(id),

  -- Razorpay
  razorpay_order_id text unique,
  razorpay_payment_id text,
  razorpay_signature text,
  payment_status payment_status not null default 'pending',
  amount_inr numeric(10, 2) not null,

  -- Attendee details (mirrors the existing Townscript form)
  full_name text not null,
  email text not null,
  phone_country_code text not null default '+91',
  phone text not null,
  gender text not null check (gender in ('male', 'female', 'others')),
  city text not null,
  organization text,
  running_community text,
  date_of_birth date not null,
  tshirt_size text not null,
  emergency_country_code text not null default '+91',
  emergency_phone text not null,

  -- KYC / prize-money details (competitive categories)
  aadhar_number text,
  govt_id_file_path text, -- path inside the private 'govt-ids' storage bucket
  bank_name_location text,
  bank_account_number text,
  bank_ifsc text,
  pan_number text,

  -- Consents
  accepted_waiver boolean not null default false,
  accepted_rules boolean not null default false,

  -- Race day
  bib_number text,
  checked_in boolean not null default false,
  checked_in_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on registrations (event_id);
create index on registrations (ticket_category_id);
create index on registrations (payment_status);
create index on registrations (email);
create index on registrations (phone);

-- ---------------------------------------------------------------------------
-- registration_addons (addons attached to a registration/order)
-- ---------------------------------------------------------------------------
create table registration_addons (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  addon_id uuid not null references addons(id),
  quantity int not null default 1,
  name_snapshot text not null,
  price_inr_snapshot numeric(10, 2) not null
);

create index on registration_addons (registration_id);

-- ---------------------------------------------------------------------------
-- wa_message_log (AiSensy WhatsApp send audit trail)
-- ---------------------------------------------------------------------------
create table wa_message_log (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations(id) on delete cascade,
  template_name text not null,
  status text not null default 'queued', -- queued | sent | failed
  provider_message_id text,
  error text,
  sent_at timestamptz not null default now()
);

create index on wa_message_log (registration_id);

-- ---------------------------------------------------------------------------
-- admin_allowlist (which Supabase Auth users may access /admin)
-- ---------------------------------------------------------------------------
create table admin_allowlist (
  email text primary key,
  added_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger for registrations
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger registrations_set_updated_at
before update on registrations
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table events enable row level security;
alter table ticket_categories enable row level security;
alter table addons enable row level security;
alter table registrations enable row level security;
alter table registration_addons enable row level security;
alter table wa_message_log enable row level security;
alter table admin_allowlist enable row level security;

-- Public (anon key) may read active events / catalog only — needed so the
-- event page can render ticket options without a server round trip if desired.
-- Everything else (registrations, KYC, admin) has NO anon/authenticated
-- policies: only the service role (server-side, bypasses RLS) can touch them.
create policy "public can read active events"
  on events for select
  using (is_active = true);

create policy "public can read active ticket categories"
  on ticket_categories for select
  using (is_active = true);

create policy "public can read active addons"
  on addons for select
  using (is_active = true);

-- No policies on registrations, registration_addons, wa_message_log,
-- admin_allowlist => default-deny for anon/authenticated roles. The /admin
-- dashboard reads through a server route using the service role key, after
-- verifying the caller's Supabase session email is in admin_allowlist.
-- Seed data for LetsRun TGCG 2026.
--
-- Verified 2026-09-12 directly against the live Townscript booking flow
-- (www.townscript.com/v2/e/letsrun-tgcg-2026/booking/tickets) using the
-- organizer login. The "Non Runner Friend" and "Accompanying Child" add-ons
-- were not offered on the live ticket list at all (they showed "SALE ENDED"
-- in an earlier Aug 31 snapshot), so they're seeded inactive — flip
-- is_active back on in Supabase if/when they're relisted.

insert into events (slug, name, description, venue, event_date, starts_at_text, is_active)
values (
  'tgcg-2026',
  'LetsRun TGCG 2026',
  'The Great Chhattisgarh Run - 9th edition qualifier run (RFID timed), the first run in Central India certified by AIMS/IAAF. Cash prizes for the top 3 in 42KM, 21KM and 10KM, plus a special women''s category prize.',
  'Ekatma Path Park, Ekatma Path, Sector 21, Atal Nagar-Nava Raipur',
  '2026-12-20',
  '4:00 AM IST Onwards',
  true
)
on conflict (slug) do nothing;

do $$
declare
  v_event_id uuid;
begin
  select id into v_event_id from events where slug = 'tgcg-2026';

  insert into ticket_categories (event_id, "group", name, description, price_inr, min_age, requires_kyc, sort_order)
  values
    (v_event_id, 'competitive', '21 KM Half Marathon Competitive', 'For runners who wish to compete for prizes. All required details must be accurate; incomplete/incorrect info leads to disqualification without claims.', 1454, 16, true, 1),
    (v_event_id, 'competitive', '10KM - Beginner Delight Competitive', 'For runners who wish to compete for prizes. All required details must be accurate; incomplete/incorrect info leads to disqualification without claims.', 1454, 14, true, 2),
    (v_event_id, 'competitive', '42 KM Marathon Competitive', 'For runners who wish to compete for prizes. All required details must be accurate; incomplete/incorrect info leads to disqualification without claims.', 1454, 18, true, 3),
    (v_event_id, 'non_competitive', '42 KM Marathon Non Competitive', 'For runners who wish to participate for the experience, fitness, and joy of running — without competing for prizes.', 1205, 18, false, 4),
    (v_event_id, 'non_competitive', '21 KM Half Marathon Non Competitive', 'For runners who wish to participate for the experience, fitness, and joy of running — without competing for prizes.', 1205, 16, false, 5),
    (v_event_id, 'non_competitive', '10KM - Beginner Delight Non Competitive', 'For runners who wish to participate for the experience, fitness, and joy of running — without competing for prizes.', 1205, 14, false, 6),
    (v_event_id, 'non_competitive', '6KM - Dream Run Non Competitive', 'For runners who wish to participate for the experience, fitness, and joy of running — without competing for prizes.', 1205, 12, false, 7)
  on conflict do nothing;

  insert into addons (event_id, name, description, price_inr, is_active, sort_order)
  values
    (v_event_id, 'Non Runner Friend', 'Accompanying Guest Pass for non-running friends, drivers, assistants, or parents. Non-timed bib, access to the holding area.', 650, false, 1),
    (v_event_id, 'Accompanying Child (up to 10 years)', 'Child Runner Pass for children accompanying a registered runner. Non-timed bib, access to the holding area.', 600, false, 2)
  on conflict do nothing;
end $$;
-- Private storage bucket for government-ID uploads (Aadhar/PAN/etc).
-- No public read access; files are only ever accessed server-side via the
-- service role key (e.g. from the admin dashboard) using short-lived signed URLs.

insert into storage.buckets (id, name, public)
values ('govt-ids', 'govt-ids', false)
on conflict (id) do nothing;

-- No storage.objects policies are created for anon/authenticated roles, so
-- only the service role (server) can read/write into this bucket.
-- Keeps ticket_categories.sold_count / addons.sold_count in sync whenever a
-- registration's payment_status transitions into or out of 'paid'. This is
-- the single source of truth for capacity checks in /api/register — both the
-- client-side verify callback and the Razorpay webhook update payment_status
-- via a plain UPDATE, so a trigger is the only place guaranteed to run once
-- per real transition regardless of which path fired.

create or replace function sync_sold_counts()
returns trigger as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    update ticket_categories
      set sold_count = sold_count + 1
      where id = new.ticket_category_id;

    update addons
      set sold_count = sold_count + ra.quantity
      from registration_addons ra
      where addons.id = ra.addon_id
        and ra.registration_id = new.id;

  elsif old.payment_status = 'paid' and new.payment_status is distinct from 'paid' then
    update ticket_categories
      set sold_count = greatest(sold_count - 1, 0)
      where id = new.ticket_category_id;

    update addons
      set sold_count = greatest(addons.sold_count - ra.quantity, 0)
      from registration_addons ra
      where addons.id = ra.addon_id
        and ra.registration_id = new.id;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger registrations_sync_sold_counts
after update on registrations
for each row execute function sync_sold_counts();
insert into admin_allowlist (email) values
  ('letsrunteam@gmail.com'),
  ('risewithharsh@gmail.com')
on conflict (email) do nothing;
-- Generalize wa_message_log to cover both WhatsApp (AiSensy) and email
-- (Gmail SMTP) confirmation sends, so both show up in one audit trail.

alter table wa_message_log
  add column if not exists channel text not null default 'whatsapp';

alter table wa_message_log
  add constraint wa_message_log_channel_check check (channel in ('whatsapp', 'email'));
