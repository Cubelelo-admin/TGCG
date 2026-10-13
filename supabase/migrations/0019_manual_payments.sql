-- Manual payment override: registrations that dropped off at checkout
-- (pending / failed) and were then collected directly — e.g. a follow-up
-- call where the runner pays by UPI straight into the organizer's account —
-- can be marked paid from the admin page without a Razorpay order.
--
-- payment_method records HOW a paid registration was paid, so money that
-- never went through Razorpay can be flagged, filtered and totalled
-- separately from Razorpay settlements:
--   razorpay    — public checkout (default for every new row)
--   manual      — admin override after collecting payment directly
--   bulk_import — offline/paper registrations digitized via bulk upload

alter table registrations
  add column if not exists payment_method text not null default 'razorpay'
    check (payment_method in ('razorpay', 'manual', 'bulk_import'));

alter table registrations add column if not exists manual_payment_mode text
  check (manual_payment_mode in ('upi', 'cash', 'bank_transfer', 'other'));
alter table registrations add column if not exists manual_payment_ref text;
alter table registrations add column if not exists manual_payment_note text;
alter table registrations add column if not exists manual_paid_by text;
alter table registrations add column if not exists manual_paid_at timestamptz;

create index if not exists registrations_payment_method_idx on registrations (payment_method);

-- Backfill: every bulk import so far was inserted with no Razorpay order and
-- flipped straight to paid (see api/admin/registrations/bulk-import), so a
-- paid row with no order id can only have come from there.
update registrations
  set payment_method = 'bulk_import'
  where payment_status = 'paid'
    and razorpay_order_id is null
    and payment_method = 'razorpay';

-- Atomically marks a set of registrations (one whole booking) paid via a
-- direct payment. One UPDATE statement, so a booking can never end up
-- half-paid, and the existing row-level triggers (set_registration_code,
-- set_bib_number, sync_sold_counts) fire once per row exactly as they do for
-- a Razorpay payment. The status guard makes it race-safe against a late
-- Razorpay webhook: a row Razorpay already flipped to paid simply isn't
-- touched. Returns the ids actually updated.
create or replace function admin_mark_paid(
  p_ids uuid[],
  p_amounts numeric[],
  p_mode text,
  p_ref text,
  p_note text,
  p_admin text
)
returns setof uuid as $$
  update registrations r
  set payment_status = 'paid',
      payment_method = 'manual',
      amount_inr = v.amount,
      manual_payment_mode = p_mode,
      manual_payment_ref = p_ref,
      manual_payment_note = p_note,
      manual_paid_by = p_admin,
      manual_paid_at = now()
  from unnest(p_ids, p_amounts) as v(id, amount)
  where r.id = v.id
    and r.payment_status in ('pending', 'failed')
  returning r.id;
$$ language sql;

-- Paid totals per payment method, aggregated in Postgres. Summing rows in
-- the app would silently truncate at PostgREST's 1000-row response cap.
create or replace function payment_totals(p_event_id uuid)
returns table (payment_method text, paid_count bigint, amount_inr numeric) as $$
  select r.payment_method, count(*), coalesce(sum(r.amount_inr), 0)
  from registrations r
  where r.event_id = p_event_id and r.payment_status = 'paid'
  group by r.payment_method;
$$ language sql stable;

-- Service role only (same as every other PII path) — never callable by
-- anon/authenticated through PostgREST.
revoke execute on function admin_mark_paid(uuid[], numeric[], text, text, text, text) from public, anon, authenticated;
revoke execute on function payment_totals(uuid) from public, anon, authenticated;
grant execute on function admin_mark_paid(uuid[], numeric[], text, text, text, text) to service_role;
grant execute on function payment_totals(uuid) to service_role;
