-- Admin category changes across competitive / non-competitive, with the
-- price difference settled offline.
--
-- Until now the admin edit dialog could only move a registration to another
-- category in the SAME group (competitive ↔ competitive, non-competitive ↔
-- non-competitive). Organizers now need to move runners across groups too
-- (e.g. a 10 KM Fun Run upgraded to 21 KM Competitive). The money for the
-- difference is collected (or refunded) outside Razorpay, exactly like a
-- manual / bulk-import payment, and the POC who handled that money is
-- recorded against it.
--
-- Design:
--   * registrations.amount_inr is NOT touched for a paid row — it stays what
--     was actually paid through the original method, so the Razorpay total
--     keeps reconciling with Razorpay settlements.
--   * Every category change on a paid registration writes one row to
--     registration_adjustments: from/to category, the list-price difference,
--     the amount actually collected (negative = refunded), mode, reference,
--     note, POC and which admin did it. payment_totals / poc_totals add these
--     amounts on top, under "collected directly".
--   * Category names are stored as a text snapshot (ids kept for reference,
--     but deliberately WITHOUT foreign keys to ticket_categories): two FKs
--     from this table to ticket_categories alongside the one to registrations
--     could make PostgREST's registrations → ticket_categories embed
--     ambiguous, and that embed powers the whole admin listing.
--
-- Also fixes sync_sold_counts (0004), which only reacted to payment_status
-- transitions: moving an already-paid registration between categories left
-- sold_count on the old category forever. Same-group category changes have
-- had this drift since they were added — the backfill at the bottom
-- recomputes sold_count from the registrations themselves.
--
-- Safe to run on the live database; runs as one transaction; safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- 1. Adjustments ledger
-- ---------------------------------------------------------------------------
create table if not exists registration_adjustments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  kind text not null default 'category_change' check (kind in ('category_change')),

  from_category_id uuid,
  from_category_name text,
  from_price_inr numeric(10, 2),
  to_category_id uuid,
  to_category_name text,
  to_price_inr numeric(10, 2),

  -- to_price - from_price, computed server-side at change time.
  price_diff_inr numeric(10, 2) not null default 0,
  -- What was actually collected offline (negative = refunded to the runner).
  amount_inr numeric(10, 2) not null default 0,

  mode text check (mode in ('upi', 'cash', 'bank_transfer', 'other')),
  reference text,
  note text,
  poc_name text,
  created_by text,
  created_at timestamptz not null default now(),

  -- Any money moving (or a waived difference) must name who handled it.
  constraint registration_adjustments_poc_required
    check ((amount_inr = 0 and price_diff_inr = 0) or nullif(trim(poc_name), '') is not null)
);

create index if not exists registration_adjustments_registration_idx
  on registration_adjustments (registration_id);
create index if not exists registration_adjustments_event_idx
  on registration_adjustments (event_id);

-- PII-adjacent, same rule as every other table: service role only.
alter table registration_adjustments enable row level security;

-- ---------------------------------------------------------------------------
-- 2. sold_count follows category changes
-- ---------------------------------------------------------------------------
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
    -- old.ticket_category_id: that's the category it was counted against.
    update ticket_categories
      set sold_count = greatest(sold_count - 1, 0)
      where id = old.ticket_category_id;

    update addons
      set sold_count = greatest(addons.sold_count - ra.quantity, 0)
      from registration_addons ra
      where addons.id = ra.addon_id
        and ra.registration_id = new.id;

  elsif new.payment_status = 'paid'
        and old.payment_status = 'paid'
        and new.ticket_category_id is distinct from old.ticket_category_id then
    update ticket_categories
      set sold_count = greatest(sold_count - 1, 0)
      where id = old.ticket_category_id;
    update ticket_categories
      set sold_count = sold_count + 1
      where id = new.ticket_category_id;
  end if;

  return new;
end;
$$ language plpgsql;

-- Recompute from source of truth (fixes drift from earlier same-group moves).
update ticket_categories tc
set sold_count = (
  select count(*) from registrations r
  where r.ticket_category_id = tc.id and r.payment_status = 'paid'
);

-- ---------------------------------------------------------------------------
-- 3. Atomic category change
-- ---------------------------------------------------------------------------
-- Moves one registration to another category and, if it is paid, records the
-- offline adjustment — in one transaction, so a category can never change
-- without its money trail (or vice versa). p_expected_category guards against
-- two admins editing the same row at once. p_reset_bib clears the BIB so
-- set_bib_number (0021) re-issues one from the new distance's pool on this
-- same UPDATE (the old number goes back to bib_released).
create or replace function admin_change_category(
  p_id uuid,
  p_expected_category uuid,
  p_new_category uuid,
  p_reset_bib boolean,
  p_amount numeric,
  p_mode text,
  p_ref text,
  p_note text,
  p_poc text,
  p_admin text
)
returns uuid as $$
declare
  v_reg registrations%rowtype;
  v_from ticket_categories%rowtype;
  v_to ticket_categories%rowtype;
  v_adjustment_id uuid;
begin
  select * into v_reg from registrations where id = p_id for update;
  if not found then
    raise exception 'registration % not found', p_id;
  end if;
  if v_reg.ticket_category_id is distinct from p_expected_category then
    raise exception 'category_changed_concurrently';
  end if;

  select * into v_from from ticket_categories where id = v_reg.ticket_category_id;
  select * into v_to from ticket_categories where id = p_new_category;

  update registrations
  set ticket_category_id = p_new_category,
      bib_number = case when p_reset_bib then null else bib_number end,
      updated_at = now()
  where id = p_id;

  if v_reg.payment_status = 'paid' then
    insert into registration_adjustments (
      registration_id, event_id,
      from_category_id, from_category_name, from_price_inr,
      to_category_id, to_category_name, to_price_inr,
      price_diff_inr, amount_inr,
      mode, reference, note, poc_name, created_by
    ) values (
      v_reg.id, v_reg.event_id,
      v_from.id, v_from.name, v_from.price_inr,
      v_to.id, v_to.name, v_to.price_inr,
      coalesce(v_to.price_inr, 0) - coalesce(v_from.price_inr, 0), coalesce(p_amount, 0),
      p_mode, nullif(trim(p_ref), ''), nullif(trim(p_note), ''), nullif(trim(p_poc), ''), p_admin
    )
    returning id into v_adjustment_id;
  end if;

  return v_adjustment_id;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 4. Totals include adjustments
-- ---------------------------------------------------------------------------
-- Extra pseudo payment_method 'category_adjustment': paid_count = number of
-- adjustments, amount = net collected (refunds negative).
create or replace function payment_totals(p_event_id uuid)
returns table (payment_method text, paid_count bigint, amount_inr numeric) as $$
  select r.payment_method, count(*), coalesce(sum(r.amount_inr), 0)
  from registrations r
  where r.event_id = p_event_id and r.payment_status = 'paid'
  group by r.payment_method
  union all
  select 'category_adjustment', count(*), coalesce(sum(a.amount_inr), 0)
  from registration_adjustments a
  join registrations r on r.id = a.registration_id
  where a.event_id = p_event_id and r.payment_status = 'paid'
  having count(*) > 0;
$$ language sql stable;

-- Per POC: bulk/offline registrations they collected for, plus category-change
-- differences they collected or refunded.
create or replace function poc_totals(p_event_id uuid)
returns table (poc_name text, paid_count bigint, amount_inr numeric) as $$
  select x.poc_name, sum(x.cnt)::bigint, sum(x.amt)
  from (
    select r.poc_name, count(*) as cnt, coalesce(sum(r.amount_inr), 0) as amt
    from registrations r
    where r.event_id = p_event_id
      and r.payment_status = 'paid'
      and r.poc_name is not null
    group by r.poc_name
    union all
    select a.poc_name, count(distinct a.registration_id), coalesce(sum(a.amount_inr), 0)
    from registration_adjustments a
    join registrations r on r.id = a.registration_id
    where a.event_id = p_event_id
      and r.payment_status = 'paid'
      and a.poc_name is not null
    group by a.poc_name
  ) x
  group by x.poc_name
  order by x.poc_name;
$$ language sql stable;

revoke execute on function admin_change_category(uuid, uuid, uuid, boolean, numeric, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function admin_change_category(uuid, uuid, uuid, boolean, numeric, text, text, text, text, text)
  to service_role;
revoke execute on function payment_totals(uuid) from public, anon, authenticated;
grant execute on function payment_totals(uuid) to service_role;
revoke execute on function poc_totals(uuid) from public, anon, authenticated;
grant execute on function poc_totals(uuid) to service_role;

commit;
