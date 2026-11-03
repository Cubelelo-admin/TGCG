-- Two changes, both needed before the second event (TGCG Raigarh, Feb 2027)
-- can share this database with TGCG 2026:
--
-- 1. POC on bulk imports. Every offline/bulk-imported registration now
--    records the point of contact for its group — the person responsible for
--    collecting the money for those registrations — so collections can be
--    totalled and chased per POC (poc_totals below).
--
-- 2. Per-event numbering. Registration codes, booking codes and BIB numbers
--    were all drawn from global counters, so a second event would have
--    continued TGCG 2026's sequences ("TGCG-0412", BIB 21347 ...). Each event
--    now has its own code prefix and its own counters:
--      TGCG 2026      → TGCG-0001 / TGCG-G-0001 / 42001, 21001 ...
--      Raigarh 2027   → RGH-0001  / RGH-G-0001  / 42001, 21001 ...
--    BIB uniqueness becomes per event (the same number can exist once in each
--    event). TGCG 2026's existing codes, BIBs and counters are carried over
--    unchanged — no issued number moves.
--
-- Safe to run on the live database: additive columns, counters seeded from
-- what has already been issued, and the trigger functions are replaced in
-- place (the triggers themselves keep calling them by name). Runs as one
-- transaction and is safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- 1. POC
-- ---------------------------------------------------------------------------
alter table registrations add column if not exists poc_name text;

create index if not exists registrations_event_poc_idx
  on registrations (event_id, poc_name)
  where poc_name is not null;

-- Paid count/amount per POC, aggregated in Postgres for the same reason as
-- payment_totals (0019): summing in the app would truncate at PostgREST's
-- 1000-row response cap.
create or replace function poc_totals(p_event_id uuid)
returns table (poc_name text, paid_count bigint, amount_inr numeric) as $$
  select r.poc_name, count(*), coalesce(sum(r.amount_inr), 0)
  from registrations r
  where r.event_id = p_event_id
    and r.payment_status = 'paid'
    and r.poc_name is not null
  group by r.poc_name
  order by r.poc_name;
$$ language sql stable;

revoke execute on function poc_totals(uuid) from public, anon, authenticated;
grant execute on function poc_totals(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2a. Per-event registration / booking codes
-- ---------------------------------------------------------------------------
alter table events add column if not exists code_prefix text;
alter table events add column if not exists registration_seq int not null default 0;
alter table events add column if not exists booking_seq int not null default 0;

update events set code_prefix = 'TGCG' where slug = 'tgcg-2026' and code_prefix is null;
-- Any other pre-existing event gets a prefix derived from its slug, so the
-- column can be made NOT NULL. Set a nicer one by hand if this ever fires.
update events
  set code_prefix = upper(left(regexp_replace(slug, '[^a-zA-Z0-9]', '', 'g'), 6))
  where code_prefix is null;

alter table events alter column code_prefix set not null;
create unique index if not exists events_code_prefix_key on events (code_prefix);

-- Carry TGCG 2026's numbering forward from whichever is higher: the old
-- global sequence, or the highest code actually on a row. (Before this
-- migration only one event existed, so everything issued so far is its.)
update events e
set registration_seq = greatest(
      e.registration_seq,
      (select case when is_called then last_value else last_value - 1 end from registration_code_seq),
      coalesce((
        select max((substring(registration_code from '(\d+)$'))::int)
        from registrations
        where registration_code ~ '^TGCG-\d+$'
      ), 0)
    ),
    booking_seq = greatest(
      e.booking_seq,
      (select case when is_called then last_value else last_value - 1 end from booking_code_seq),
      coalesce((
        select max((substring(booking_code from '(\d+)$'))::int)
        from registration_groups
        where booking_code ~ '^TGCG-G-\d+$'
      ), 0)
    )
where e.slug = 'tgcg-2026';

-- Same trigger point as 0008: assigned on the transition into 'paid'. The
-- UPDATE ... RETURNING on the event row is the per-event atomic counter
-- (row lock), exactly how bib_counters already works.
create or replace function set_registration_code()
returns trigger as $$
declare
  v_prefix text;
  v_seq int;
begin
  if new.payment_status = 'paid' and new.registration_code is null then
    update events
    set registration_seq = registration_seq + 1
    where id = new.event_id
    returning code_prefix, registration_seq into v_prefix, v_seq;

    new.registration_code := v_prefix || '-' || lpad(v_seq::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

-- Same idempotent/race-safe contract as 0011, now numbered per event.
create or replace function assign_booking_code(p_group_id uuid)
returns text as $$
declare
  v_code text;
  v_event_id uuid;
  v_prefix text;
  v_seq int;
begin
  select booking_code, event_id into v_code, v_event_id
  from registration_groups where id = p_group_id
  for update;

  if v_code is not null or v_event_id is null then
    return v_code;
  end if;

  update events
  set booking_seq = booking_seq + 1
  where id = v_event_id
  returning code_prefix, booking_seq into v_prefix, v_seq;

  update registration_groups
  set booking_code = v_prefix || '-G-' || lpad(v_seq::text, 4, '0')
  where id = p_group_id and booking_code is null
  returning booking_code into v_code;

  return v_code;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 2b. Per-event BIB pools
-- ---------------------------------------------------------------------------
-- bib_counters: (prefix) → (event_id, prefix)
alter table bib_counters add column if not exists event_id uuid references events(id) on delete cascade;
update bib_counters
  set event_id = (select id from events where slug = 'tgcg-2026')
  where event_id is null;

-- bib_released: (bib_number) → (event_id, bib_number)
alter table bib_released add column if not exists event_id uuid references events(id) on delete cascade;
update bib_released
  set event_id = (select id from events where slug = 'tgcg-2026')
  where event_id is null;

alter table bib_released drop constraint if exists bib_released_counter_fkey; -- (re-run)
alter table bib_released drop constraint if exists bib_released_prefix_fkey;
alter table bib_released drop constraint if exists bib_released_pkey;
alter table bib_counters drop constraint if exists bib_counters_pkey;

alter table bib_counters alter column event_id set not null;
alter table bib_counters add primary key (event_id, prefix);

alter table bib_released alter column event_id set not null;
alter table bib_released add primary key (event_id, bib_number);
alter table bib_released
  add constraint bib_released_counter_fkey
  foreign key (event_id, prefix) references bib_counters (event_id, prefix);

drop index if exists bib_released_prefix_idx;
create index if not exists bib_released_event_prefix_idx on bib_released (event_id, prefix, bib_number);

-- One BIB per event, not one globally. SUPERHERO (child runner) stays exempt.
drop index if exists registrations_bib_number_unique_idx;
create unique index if not exists registrations_event_bib_number_unique_idx
  on registrations (event_id, bib_number)
  where bib_number is not null and bib_number <> 'SUPERHERO';

drop index if exists registrations_bib_number_idx;
create index if not exists registrations_event_bib_number_idx on registrations (event_id, bib_number);

-- Which distance pool a BIB belongs to within an event (see 0020).
create or replace function bib_pool_prefix(p_event_id uuid, p_bib text)
returns text as $$
  select prefix from bib_counters
  where event_id = p_event_id
    and p_bib ~ '^\d{5}$'
    and left(p_bib, length(prefix)) = prefix
  order by length(prefix) desc
  limit 1;
$$ language sql stable;

drop function if exists bib_pool_prefix(text);

-- 0020's logic, scoped by event. A new event's counter rows are created on
-- first use, so adding an event never needs a bib_counters seed.
create or replace function set_bib_number()
returns trigger as $$
declare
  v_prefix text;
  v_fixed text;
  v_seq int;
  v_digits int;
  v_bib text;
  v_old_prefix text;
begin
  -- 1. Release: this row is giving up a pooled number — put it back.
  if tg_op = 'UPDATE'
     and old.bib_number is not null
     and new.bib_number is distinct from old.bib_number then
    v_old_prefix := bib_pool_prefix(old.event_id, old.bib_number);
    if v_old_prefix is not null then
      insert into bib_released (event_id, bib_number, prefix)
      values (old.event_id, old.bib_number, v_old_prefix)
      on conflict (event_id, bib_number) do nothing;
    end if;
  end if;

  -- 2. A number an admin typed in by hand is no longer free.
  if new.bib_number is not null
     and (tg_op = 'INSERT' or new.bib_number is distinct from old.bib_number) then
    delete from bib_released where event_id = new.event_id and bib_number = new.bib_number;
  end if;

  -- 3. Assign on payment.
  if new.payment_status = 'paid' and new.bib_number is null then
    select bib_prefix, bib_fixed_label into v_prefix, v_fixed
    from ticket_categories where id = new.ticket_category_id;

    if v_fixed is not null then
      new.bib_number := v_fixed;
    elsif v_prefix is not null then
      insert into bib_counters (event_id, prefix) values (new.event_id, v_prefix)
      on conflict (event_id, prefix) do nothing;

      select b.bib_number into v_bib
      from bib_released b
      where b.event_id = new.event_id
        and b.prefix = v_prefix
        and not exists (
          select 1 from registrations r
          where r.event_id = new.event_id and r.bib_number = b.bib_number
        )
      order by b.bib_number
      limit 1
      for update skip locked;

      if v_bib is not null then
        delete from bib_released where event_id = new.event_id and bib_number = v_bib;
      else
        v_digits := 5 - length(v_prefix);
        loop
          update bib_counters set last_value = last_value + 1
          where event_id = new.event_id and prefix = v_prefix
          returning last_value into v_seq;

          if length(v_seq::text) > v_digits then
            raise exception 'BIB pool exhausted for prefix % in event %', v_prefix, new.event_id;
          end if;

          v_bib := v_prefix || lpad(v_seq::text, v_digits, '0');
          exit when not exists (
            select 1 from registrations
            where event_id = new.event_id and bib_number = v_bib
          );
        end loop;
      end if;

      new.bib_number := v_bib;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

commit;
