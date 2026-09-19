-- Auto-generated race BIB numbers, assigned the moment a registration is
-- confirmed paid — same trigger point as registration_code (see
-- 0008_registration_code.sql) and for the same reason: pending/abandoned/
-- failed carts must never consume a BIB, since once allotted a number can
-- never be reused even after being cleared from a registration.
--
-- Format: a per-distance prefix + zero-padded sequence, always 5 digits
-- total (42xxx / 21xxx / 10xxx / 6xxxx). Competitive and non-competitive
-- entrants of the same distance share one pool. Child Runner gets the fixed
-- label "SUPERHERO" instead of a numeric BIB — it's explicitly "no BIB/race
-- entry" per 0014_child_runner.sql.

alter table ticket_categories add column if not exists bib_prefix text;
alter table ticket_categories add column if not exists bib_fixed_label text;

update ticket_categories set bib_prefix = '42'
  where name in ('42 KM Marathon Competitive', '42 KM Marathon Non Competitive');
update ticket_categories set bib_prefix = '21'
  where name in ('21 KM Half Marathon Competitive', '21 KM Half Marathon Non Competitive');
update ticket_categories set bib_prefix = '10'
  where name in ('10KM - Beginner Delight Competitive', '10KM - Beginner Delight Non Competitive');
update ticket_categories set bib_prefix = '6'
  where name = '6KM - Dream Run Non Competitive';
update ticket_categories set bib_fixed_label = 'SUPERHERO'
  where name = 'Child Runner (Below 12)';

-- One shared atomic counter per distance prefix (not per ticket_category_id,
-- since competitive/non-competitive of the same distance draw from the same
-- pool). Plain row-level UPDATE ... RETURNING is race-safe under concurrent
-- payments the same way bib_counters's row lock always is in Postgres.
create table if not exists bib_counters (
  prefix text primary key,
  last_value int not null default 0
);

insert into bib_counters (prefix) values ('42'), ('21'), ('10'), ('6')
on conflict (prefix) do nothing;

-- Every Child Runner intentionally shares the literal "SUPERHERO" label, so
-- uniqueness is enforced with a partial index rather than a plain unique
-- constraint on the column.
create unique index if not exists registrations_bib_number_unique_idx
  on registrations (bib_number)
  where bib_number is not null and bib_number <> 'SUPERHERO';

create or replace function set_bib_number()
returns trigger as $$
declare
  v_prefix text;
  v_fixed text;
  v_seq int;
  v_digits int;
begin
  if new.payment_status = 'paid' and new.bib_number is null then
    select bib_prefix, bib_fixed_label into v_prefix, v_fixed
    from ticket_categories where id = new.ticket_category_id;

    if v_fixed is not null then
      new.bib_number := v_fixed;
    elsif v_prefix is not null then
      update bib_counters set last_value = last_value + 1
      where prefix = v_prefix
      returning last_value into v_seq;

      v_digits := 5 - length(v_prefix);
      if length(v_seq::text) > v_digits then
        raise exception 'BIB pool exhausted for prefix %', v_prefix;
      end if;

      new.bib_number := v_prefix || lpad(v_seq::text, v_digits, '0');
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger registrations_set_bib_number
before insert or update on registrations
for each row execute function set_bib_number();

-- Backfill already-paid registrations (the event is live; real paid
-- registrants may already exist from before this migration) in created_at
-- order per category, so earlier registrants get lower numbers. A no-op
-- UPDATE (same row, same value) is enough to re-fire the trigger above one
-- row at a time, reusing the exact same assignment logic instead of
-- duplicating it here.
do $$
declare
  r record;
begin
  for r in
    select id from registrations
    where payment_status = 'paid' and bib_number is null
    order by created_at
  loop
    update registrations set bib_number = bib_number where id = r.id;
  end loop;
end $$;
