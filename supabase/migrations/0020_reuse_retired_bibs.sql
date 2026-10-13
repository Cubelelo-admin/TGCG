-- Reuse retired BIB numbers instead of leaving permanent gaps.
--
-- Until now a BIB, once taken off a registration (an admin switching a paid
-- runner from 42K to 21K, or retyping/clearing the BIB field), was simply
-- abandoned: bib_counters only ever counts up, so that number was never
-- issued again. From here on every number a registration gives up goes into
-- bib_released, and set_bib_number hands those out first — lowest number
-- first, per distance — before drawing a fresh one from the counter.

create table if not exists bib_released (
  bib_number text primary key,
  prefix text not null references bib_counters(prefix),
  released_at timestamptz not null default now()
);

create index if not exists bib_released_prefix_idx on bib_released (prefix, bib_number);

-- The existing unique index on bib_number is partial (excludes SUPERHERO),
-- so the planner can't use it for the "is this number taken?" lookups
-- below — a plain index keeps those cheap.
create index if not exists registrations_bib_number_idx on registrations (bib_number);

alter table bib_released enable row level security;
-- No anon/authenticated policies — only the trigger below touches it.

-- Which distance pool a BIB belongs to, or null for anything outside the
-- auto-generated format (SUPERHERO, or an odd number an admin typed by hand).
create or replace function bib_pool_prefix(p_bib text)
returns text as $$
  select prefix from bib_counters
  where p_bib ~ '^\d{5}$' and left(p_bib, length(prefix)) = prefix
  order by length(prefix) desc
  limit 1;
$$ language sql stable;

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
    v_old_prefix := bib_pool_prefix(old.bib_number);
    if v_old_prefix is not null then
      insert into bib_released (bib_number, prefix)
      values (old.bib_number, v_old_prefix)
      on conflict (bib_number) do nothing;
    end if;
  end if;

  -- 2. A number an admin typed in by hand is no longer free.
  if new.bib_number is not null
     and (tg_op = 'INSERT' or new.bib_number is distinct from old.bib_number) then
    delete from bib_released where bib_number = new.bib_number;
  end if;

  -- 3. Assign on payment, same trigger point as before (0016_bib_number.sql).
  if new.payment_status = 'paid' and new.bib_number is null then
    select bib_prefix, bib_fixed_label into v_prefix, v_fixed
    from ticket_categories where id = new.ticket_category_id;

    if v_fixed is not null then
      new.bib_number := v_fixed;
    elsif v_prefix is not null then
      -- Lowest retired number first. SKIP LOCKED lets two concurrent
      -- payments each take a different one instead of queueing on the same
      -- row; the NOT EXISTS skips any number still held by a row (e.g. this
      -- very row's own just-released BIB, which it hasn't let go of yet
      -- until this UPDATE commits).
      select b.bib_number into v_bib
      from bib_released b
      where b.prefix = v_prefix
        and not exists (select 1 from registrations r where r.bib_number = b.bib_number)
      order by b.bib_number
      limit 1
      for update skip locked;

      if v_bib is not null then
        delete from bib_released where bib_number = v_bib;
      else
        -- Fresh number from the counter, skipping any that an admin already
        -- typed onto someone by hand — previously that collision made the
        -- whole payment UPDATE fail on the unique index.
        v_digits := 5 - length(v_prefix);
        loop
          update bib_counters set last_value = last_value + 1
          where prefix = v_prefix
          returning last_value into v_seq;

          if length(v_seq::text) > v_digits then
            raise exception 'BIB pool exhausted for prefix %', v_prefix;
          end if;

          v_bib := v_prefix || lpad(v_seq::text, v_digits, '0');
          exit when not exists (select 1 from registrations where bib_number = v_bib);
        end loop;
      end if;

      new.bib_number := v_bib;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;
-- The existing registrations_set_bib_number trigger (0016) already calls
-- this function by name — replacing the body is enough.

-- Backfill: recover every number retired before this migration — anything
-- the counter has already issued (1..last_value) that no registration holds
-- today. The counter only ever advances inside a committed assignment, so
-- each such gap is a BIB that was taken back off a runner.
insert into bib_released (bib_number, prefix)
select c.prefix || lpad(s.n::text, 5 - length(c.prefix), '0'), c.prefix
from bib_counters c
cross join lateral generate_series(1, c.last_value) as s(n)
where not exists (
  select 1 from registrations r
  where r.bib_number = c.prefix || lpad(s.n::text, 5 - length(c.prefix), '0')
)
on conflict (bib_number) do nothing;
