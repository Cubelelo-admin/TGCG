-- Expo on-demand kit flow (see docs/expo-on-demand-design.md).
--
-- Expo runners are no longer pre-packed. At the expo a desk scans the runner's QR,
-- which creates an ORDER (one runner, or a group collected together). The order gets a
-- crate ("pigeonhole") at that desk and up to three pick TASKS (bib / tshirt / pack),
-- offered to free pickers. Pickers scan a source bin, pick, scan the crate and put away.
-- When every task is put away the order is READY; the desk scans the crate and hands over.
--
-- Corporate group boxes (kit_boxes.kind = 'group_box') are untouched.
-- Replaces kit_generate_boxes (no more expo bags), kit_swap_size and kit_desk_collect.
-- Safe to re-run. Service role only (RLS on, no policies), like every other kit table.

begin;

-- ---------------------------------------------------------------------------
-- 1. Roles on the allowlist (existing admins stay 'admin')
-- ---------------------------------------------------------------------------
alter table admin_allowlist add column if not exists role text not null default 'admin';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admin_allowlist_role_check') then
    alter table admin_allowlist
      add constraint admin_allowlist_role_check check (role in ('admin', 'desk', 'picker'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create sequence if not exists kit_order_seq;

create table if not exists kit_pigeonholes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  station text not null,                                  -- D1 / D2 / D3
  size text not null check (size in ('small', 'large')),  -- small = single order, large = group
  label text not null,                                    -- printed, e.g. D1-S1 / D1-L1
  status text not null default 'free' check (status in ('free', 'busy')),
  order_id uuid,
  unique (event_id, label)
);

create table if not exists kit_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  code text not null unique,                              -- O-0001
  station text not null,
  status text not null default 'picking'
    check (status in ('picking', 'ready', 'fulfilled', 'cancelled')),
  pigeonhole_id uuid references kit_pigeonholes(id),
  created_by text,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  fulfilled_at timestamptz,
  fulfilled_by text,
  photo_path text,
  note text
);

create index if not exists kit_orders_event_status_idx on kit_orders (event_id, status);

create table if not exists kit_pickers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  email text not null,
  name text,
  specialties text[] not null default array['bib', 'tshirt', 'pack'],
  active boolean not null default false,
  current_task_id uuid,
  free_since timestamptz not null default now(),
  unique (event_id, email)
);

create table if not exists kit_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references kit_orders(id) on delete cascade,
  kind text not null check (kind in ('bib', 'tshirt', 'pack')),
  status text not null default 'queued'
    check (status in ('queued', 'offered', 'accepted', 'done', 'cancelled')),
  picker_id uuid references kit_pickers(id),
  queued_at timestamptz not null default now(),
  offered_at timestamptz,
  offer_expires_at timestamptz,
  accepted_at timestamptz,
  done_at timestamptz,
  declined_by uuid[] not null default '{}'
);

create index if not exists kit_tasks_status_idx on kit_tasks (status, queued_at);
create index if not exists kit_tasks_order_idx on kit_tasks (order_id);

create table if not exists kit_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references kit_orders(id) on delete cascade,
  task_id uuid references kit_tasks(id) on delete set null,
  registration_id uuid not null references registrations(id),
  kind text not null check (kind in ('bib', 'tshirt', 'pack')),
  size text,                                              -- tshirt only
  bin_code text not null,                                 -- BF-42001-42100 / TS-M / PACK
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  opened_at timestamptz,                                  -- source bin scanned
  picked_at timestamptz,
  done_at timestamptz
);

-- A runner can never be issued the same item twice (cancelled lines are ignored).
create unique index if not exists kit_order_lines_reg_kind_idx
  on kit_order_lines (registration_id, kind) where status <> 'cancelled';
create index if not exists kit_order_lines_order_idx on kit_order_lines (order_id);
create index if not exists kit_order_lines_task_idx on kit_order_lines (task_id);

alter table kit_pigeonholes enable row level security;
alter table kit_orders enable row level security;
alter table kit_pickers enable row level security;
alter table kit_tasks enable row level security;
alter table kit_order_lines enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

-- The BIB file a runner's BIB lives in: files of 100 numbers per distance prefix,
-- e.g. BF-42001-42100. Same numbering rule as kit_shelf_address.
create or replace function kit_bib_bin(p_reg uuid)
returns text as $$
declare
  v_prefix text;
  v_bib text;
  v_seq int;
  v_digits int;
  v_file int;
begin
  select tc.bib_prefix, r.bib_number into v_prefix, v_bib
  from registrations r join ticket_categories tc on tc.id = r.ticket_category_id
  where r.id = p_reg;

  if v_bib is null or v_bib = 'SUPERHERO' or v_prefix is null or v_bib !~ '^\d+$' then
    return 'BF-MISC';
  end if;

  v_digits := 5 - length(v_prefix);
  v_seq := substring(v_bib from length(v_prefix) + 1)::int;
  v_file := (v_seq - 1) / 100;
  return 'BF-' || v_prefix || lpad((v_file * 100 + 1)::text, v_digits, '0')
    || '-' || v_prefix || lpad(((v_file + 1) * 100)::text, v_digits, '0');
end;
$$ language plpgsql stable;

-- Which items a runner gets: same rule as kit_add_items (child runner "SUPERHERO" has no
-- BIB and no accessory pack).
create or replace function kit_build_lines(p_order uuid, p_reg uuid, p_status text)
returns void as $$
declare
  r registrations;
  v_done timestamptz := case when p_status = 'done' then now() end;
begin
  select * into r from registrations where id = p_reg;
  if r.bib_number is not null and r.bib_number <> 'SUPERHERO' then
    insert into kit_order_lines (order_id, registration_id, kind, bin_code, status, done_at)
    values (p_order, p_reg, 'bib', kit_bib_bin(p_reg), p_status, v_done);
  end if;
  if r.tshirt_size is not null then
    insert into kit_order_lines (order_id, registration_id, kind, size, bin_code, status, done_at)
    values (p_order, p_reg, 'tshirt', upper(r.tshirt_size), 'TS-' || upper(r.tshirt_size), p_status, v_done);
  end if;
  if r.bib_number is distinct from 'SUPERHERO' then
    insert into kit_order_lines (order_id, registration_id, kind, bin_code, status, done_at)
    values (p_order, p_reg, 'pack', 'PACK', p_status, v_done);
  end if;
end;
$$ language plpgsql;

-- Why a runner cannot be put into a new order (null = fine).
create or replace function kit_order_blocker(p_reg uuid)
returns text as $$
declare
  r registrations;
  v_code text;
begin
  select * into r from registrations where id = p_reg;
  if not found then return 'Runner not found'; end if;
  if r.payment_status <> 'paid' then return r.full_name || ': not paid'; end if;
  if r.kit_channel = 'corporate' then
    return r.full_name || ': corporate runner, the kit goes via the company rep';
  end if;

  if exists (
    select 1 from kit_order_lines l join kit_orders o on o.id = l.order_id
    where l.registration_id = p_reg and l.status <> 'cancelled' and o.status = 'fulfilled'
  ) or exists (
    select 1 from kit_boxes b
    where b.registration_id = p_reg and b.kind = 'expo_bag' and b.status = 'collected'
  ) then
    return r.full_name || ': kit already collected';
  end if;

  select o.code into v_code
  from kit_order_lines l join kit_orders o on o.id = l.order_id
  where l.registration_id = p_reg and l.status <> 'cancelled' and o.status in ('picking', 'ready')
  limit 1;
  if v_code is not null then
    return r.full_name || ': already in open order ' || v_code;
  end if;
  return null;
end;
$$ language plpgsql stable;

-- ---------------------------------------------------------------------------
-- 4. Pickers and pigeonholes setup
-- ---------------------------------------------------------------------------
create or replace function kit_seed_pigeonholes(
  p_event_id uuid,
  p_stations text[] default array['D1', 'D2', 'D3'],
  p_small int default 6,
  p_large int default 3
) returns jsonb as $$
declare
  s text;
  i int;
  v_added int := 0;
  v_n int;
begin
  foreach s in array p_stations loop
    for i in 1..p_small loop
      insert into kit_pigeonholes (event_id, station, size, label)
      values (p_event_id, s, 'small', s || '-S' || i)
      on conflict (event_id, label) do nothing;
      get diagnostics v_n = row_count;
      v_added := v_added + v_n;
    end loop;
    for i in 1..p_large loop
      insert into kit_pigeonholes (event_id, station, size, label)
      values (p_event_id, s, 'large', s || '-L' || i)
      on conflict (event_id, label) do nothing;
      get diagnostics v_n = row_count;
      v_added := v_added + v_n;
    end loop;
  end loop;
  return jsonb_build_object('ok', true, 'added', v_added);
end;
$$ language plpgsql;

-- Dispatch is defined below; picker toggle calls it.
create or replace function kit_dispatch(p_event_id uuid)
returns int as $$
declare
  t record;
  v_picker uuid;
  v_offers int := 0;
begin
  -- One sweep at a time. Everyone else just reads the result of the winner.
  if not pg_try_advisory_xact_lock(hashtext('kit_dispatch:' || p_event_id::text)) then
    return 0;
  end if;

  -- 1. Offers nobody took within 60 s: back to the queue, the picker is paused
  --    (assumed away) and freed, and they are remembered so another picker is next.
  with expired as (
    update kit_tasks k
    set status = 'queued',
        declined_by = k.declined_by || k.picker_id,
        picker_id = null, offered_at = null, offer_expires_at = null
    from kit_orders o
    where o.id = k.order_id and o.event_id = p_event_id
      and k.status = 'offered' and k.offer_expires_at < now()
    returning k.declined_by as declined   -- last element = the picker who let it lapse
  )
  update kit_pickers p
  set current_task_id = null, free_since = now(), active = false
  from expired e
  where p.id = e.declined[array_upper(e.declined, 1)];

  -- 2. Offer every queued task to a free, active picker.
  for t in
    select k.id, k.kind, k.queued_at, k.declined_by
    from kit_tasks k join kit_orders o on o.id = k.order_id
    where o.event_id = p_event_id and k.status = 'queued' and o.status = 'picking'
    order by k.queued_at
    for update of k skip locked
  loop
    select p.id into v_picker
    from kit_pickers p
    where p.event_id = p_event_id and p.active and p.current_task_id is null
      and (t.kind = any (p.specialties) or t.queued_at < now() - interval '90 seconds')
    order by (p.id = any (t.declined_by)), p.free_since
    limit 1
    for update skip locked;

    if v_picker is not null then
      update kit_tasks
      set status = 'offered', picker_id = v_picker, offered_at = now(),
          offer_expires_at = now() + interval '60 seconds'
      where id = t.id;
      update kit_pickers set current_task_id = t.id where id = v_picker;
      v_offers := v_offers + 1;
    end if;
  end loop;

  return v_offers;
end;
$$ language plpgsql;

create or replace function kit_picker_set_active(
  p_event_id uuid, p_email text, p_name text, p_active boolean, p_specialties text[] default null
) returns jsonb as $$
declare
  v_email text := lower(trim(p_email));
  v_picker kit_pickers;
begin
  insert into kit_pickers (event_id, email, name)
  values (p_event_id, v_email, nullif(trim(coalesce(p_name, '')), ''))
  on conflict (event_id, email) do nothing;

  select * into v_picker from kit_pickers where event_id = p_event_id and email = v_email for update;

  if not p_active and v_picker.current_task_id is not null then
    return jsonb_build_object('ok', false, 'message', 'Finish or decline your current task first');
  end if;

  update kit_pickers
  set active = p_active,
      free_since = case when p_active and not v_picker.active then now() else free_since end,
      name = coalesce(nullif(trim(coalesce(p_name, '')), ''), name),
      specialties = coalesce(p_specialties, specialties)
  where id = v_picker.id;

  if p_active then perform kit_dispatch(p_event_id); end if;

  return jsonb_build_object('ok', true, 'message', case when p_active then 'You are active' else 'You are inactive' end);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 5. Desk: create an order
-- ---------------------------------------------------------------------------
create or replace function kit_create_order(
  p_event_id uuid, p_reg_ids uuid[], p_station text, p_admin text
) returns jsonb as $$
declare
  v_ids uuid[];
  v_multi boolean;
  v_block text;
  v_reg uuid;
  v_hole kit_pigeonholes;
  v_order kit_orders;
  v_kind text;
  v_task uuid;
  v_tasks int := 0;
begin
  select array_agg(distinct x order by x) into v_ids from unnest(p_reg_ids) x;
  if v_ids is null or array_length(v_ids, 1) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Select at least one runner');
  end if;
  if array_length(v_ids, 1) > 10 then
    return jsonb_build_object('ok', false, 'message', 'At most 10 runners per order');
  end if;
  if nullif(trim(coalesce(p_station, '')), '') is null then
    return jsonb_build_object('ok', false, 'message', 'Choose your station first');
  end if;
  v_multi := array_length(v_ids, 1) > 1;

  -- Lock the runners in id order (no deadlocks), then check each one.
  perform 1 from registrations where id = any (v_ids) order by id for update;
  if (select count(*) from registrations where id = any (v_ids) and event_id = p_event_id)
     <> array_length(v_ids, 1) then
    return jsonb_build_object('ok', false, 'message', 'Runner not found in this event');
  end if;
  foreach v_reg in array v_ids loop
    v_block := kit_order_blocker(v_reg);
    if v_block is not null then
      return jsonb_build_object('ok', false, 'message', v_block);
    end if;
  end loop;

  -- A crate at THIS desk: small for one runner (a large one if no small is free),
  -- large only for a group.
  select * into v_hole
  from kit_pigeonholes
  where event_id = p_event_id and station = upper(trim(p_station)) and status = 'free'
    and (not v_multi or size = 'large')
  order by (size = case when v_multi then 'large' else 'small' end) desc, label
  limit 1
  for update skip locked;
  if not found then
    return jsonb_build_object('ok', false, 'message',
      'No free ' || case when v_multi then 'large ' else '' end || 'crate at ' || upper(trim(p_station))
      || ': wait for one to be handed over');
  end if;

  insert into kit_orders (event_id, code, station, pigeonhole_id, created_by)
  values (p_event_id, 'O-' || lpad(nextval('kit_order_seq')::text, 4, '0'), upper(trim(p_station)), v_hole.id, p_admin)
  returning * into v_order;

  update kit_pigeonholes set status = 'busy', order_id = v_order.id where id = v_hole.id;

  foreach v_reg in array v_ids loop
    perform kit_build_lines(v_order.id, v_reg, 'pending');
  end loop;

  for v_kind in select distinct kind from kit_order_lines where order_id = v_order.id order by 1 loop
    insert into kit_tasks (order_id, kind) values (v_order.id, v_kind) returning id into v_task;
    update kit_order_lines set task_id = v_task where order_id = v_order.id and kind = v_kind;
    v_tasks := v_tasks + 1;
  end loop;

  -- Nothing to pick (should not happen): straight to ready.
  if v_tasks = 0 then
    update kit_orders set status = 'ready', ready_at = now() where id = v_order.id;
  end if;

  insert into kit_log (event_id, action, detail, actor)
  values (p_event_id, 'order', v_order.code || ' ' || array_length(v_ids, 1) || ' runner(s) → ' || v_hole.label, p_admin);

  perform kit_dispatch(p_event_id);

  return jsonb_build_object('ok', true, 'message', 'Order ' || v_order.code || ' → crate ' || v_hole.label,
    'orderId', v_order.id, 'code', v_order.code, 'crate', v_hole.label, 'tasks', v_tasks);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 6. Picker: accept / decline / scan bin / pick / put away
-- ---------------------------------------------------------------------------
create or replace function kit_accept_task(p_task uuid, p_email text)
returns jsonb as $$
declare
  v_task kit_tasks;
  v_picker kit_pickers;
begin
  select * into v_task from kit_tasks where id = p_task for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Task not found'); end if;
  select * into v_picker from kit_pickers where id = v_task.picker_id;

  if v_task.status = 'accepted' and v_picker.email = lower(trim(p_email)) then
    return jsonb_build_object('ok', true, 'message', 'Already accepted');
  end if;
  if v_task.status <> 'offered' or v_picker.email is distinct from lower(trim(p_email)) then
    return jsonb_build_object('ok', false, 'message', 'This task is no longer offered to you');
  end if;
  if v_task.offer_expires_at < now() then
    return jsonb_build_object('ok', false, 'message', 'Too late: the offer expired');
  end if;

  update kit_tasks set status = 'accepted', accepted_at = now() where id = p_task;
  return jsonb_build_object('ok', true, 'message', 'Accepted');
end;
$$ language plpgsql;

create or replace function kit_decline_task(p_task uuid, p_email text)
returns jsonb as $$
declare
  v_task kit_tasks;
  v_picker kit_pickers;
  v_event uuid;
begin
  select * into v_task from kit_tasks where id = p_task for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Task not found'); end if;
  select * into v_picker from kit_pickers where id = v_task.picker_id for update;
  if v_picker.email is distinct from lower(trim(p_email)) or v_task.status not in ('offered', 'accepted') then
    return jsonb_build_object('ok', false, 'message', 'This task is not yours');
  end if;

  update kit_order_lines set opened_at = null, picked_at = null where task_id = p_task and status = 'pending';
  update kit_tasks
  set status = 'queued', declined_by = declined_by || v_picker.id, picker_id = null,
      offered_at = null, offer_expires_at = null, accepted_at = null
  where id = p_task;
  update kit_pickers set current_task_id = null, free_since = now() where id = v_picker.id;

  select event_id into v_event from kit_orders where id = v_task.order_id;
  perform kit_dispatch(v_event);
  return jsonb_build_object('ok', true, 'message', 'Declined: sent to another picker');
end;
$$ language plpgsql;

-- Supervisor: pull a stuck task back (picker gone). The picker is paused.
create or replace function kit_release_task(p_task uuid, p_admin text)
returns jsonb as $$
declare
  v_task kit_tasks;
  v_event uuid;
begin
  select * into v_task from kit_tasks where id = p_task for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Task not found'); end if;
  if v_task.status not in ('offered', 'accepted') then
    return jsonb_build_object('ok', false, 'message', 'Task is ' || v_task.status || ': nothing to release');
  end if;

  update kit_order_lines set opened_at = null, picked_at = null where task_id = p_task and status = 'pending';
  update kit_pickers set current_task_id = null, free_since = now(), active = false where id = v_task.picker_id;
  update kit_tasks
  set status = 'queued', declined_by = declined_by || coalesce(v_task.picker_id, '00000000-0000-0000-0000-000000000000'::uuid),
      picker_id = null, offered_at = null, offer_expires_at = null, accepted_at = null
  where id = p_task;

  select event_id into v_event from kit_orders where id = v_task.order_id;
  insert into kit_log (event_id, action, detail, actor)
  values (v_event, 'task', 'released ' || v_task.kind || ' task', p_admin);
  perform kit_dispatch(v_event);
  return jsonb_build_object('ok', true, 'message', 'Released');
end;
$$ language plpgsql;

-- Scan a source bin: only then does the picker see what to take from it.
create or replace function kit_pick_bin(p_task uuid, p_bin text, p_email text)
returns jsonb as $$
declare
  v_task kit_tasks;
  v_bin text := upper(trim(p_bin));
  v_items jsonb;
begin
  select * into v_task from kit_tasks where id = p_task for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Task not found'); end if;
  if v_task.status <> 'accepted'
     or (select email from kit_pickers where id = v_task.picker_id) is distinct from lower(trim(p_email)) then
    return jsonb_build_object('ok', false, 'message', 'Accept the task first');
  end if;

  update kit_order_lines set opened_at = coalesce(opened_at, now())
  where task_id = p_task and bin_code = v_bin and status = 'pending' and picked_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
      'lineId', l.id, 'kind', l.kind, 'size', l.size, 'bib', r.bib_number) order by r.bib_number), '[]'::jsonb)
  into v_items
  from kit_order_lines l join registrations r on r.id = l.registration_id
  where l.task_id = p_task and l.bin_code = v_bin and l.status = 'pending' and l.picked_at is null;

  if jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'message',
      case when exists (select 1 from kit_order_lines where task_id = p_task and bin_code = v_bin)
           then 'Nothing left to pick from ' || v_bin
           else 'WRONG BIN: ' || v_bin || ' is not for this task' end);
  end if;
  return jsonb_build_object('ok', true, 'message', 'Pick from ' || v_bin, 'items', v_items);
end;
$$ language plpgsql;

-- Confirm picked lines. BIB lines need the BIB itself scanned (one line at a time);
-- T-shirt and pack lines are confirmed in bulk (the bin scan is their check).
create or replace function kit_pick_item(p_task uuid, p_line_ids uuid[], p_scan text, p_email text)
returns jsonb as $$
declare
  v_task kit_tasks;
  l kit_order_lines;
  v_bib text;
  v_left int;
begin
  select * into v_task from kit_tasks where id = p_task for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Task not found'); end if;
  if v_task.status <> 'accepted'
     or (select email from kit_pickers where id = v_task.picker_id) is distinct from lower(trim(p_email)) then
    return jsonb_build_object('ok', false, 'message', 'Accept the task first');
  end if;
  if p_line_ids is null or array_length(p_line_ids, 1) is null then
    return jsonb_build_object('ok', false, 'message', 'Nothing selected');
  end if;
  if (select count(*) from kit_order_lines where id = any (p_line_ids)) <> array_length(p_line_ids, 1) then
    return jsonb_build_object('ok', false, 'message', 'That item is not part of this task');
  end if;

  for l in select * from kit_order_lines where id = any (p_line_ids) order by id for update loop
    if l.task_id is distinct from p_task or l.status <> 'pending' then
      return jsonb_build_object('ok', false, 'message', 'That item is not part of this task');
    end if;
    if l.opened_at is null then
      return jsonb_build_object('ok', false, 'message', 'Scan the bin first');
    end if;
    if l.kind = 'bib' then
      if array_length(p_line_ids, 1) <> 1 then
        return jsonb_build_object('ok', false, 'message', 'Scan BIBs one at a time');
      end if;
      select bib_number into v_bib from registrations where id = l.registration_id;
      if upper(trim(coalesce(p_scan, ''))) is distinct from upper(v_bib) then
        return jsonb_build_object('ok', false, 'message', 'WRONG BIB: expected ' || v_bib);
      end if;
    end if;
    update kit_order_lines set picked_at = coalesce(picked_at, now()) where id = l.id;
  end loop;

  select count(*) into v_left from kit_order_lines where task_id = p_task and status = 'pending' and picked_at is null;
  return jsonb_build_object('ok', true, 'message', 'Picked', 'left', v_left);
end;
$$ language plpgsql;

create or replace function kit_put_away(p_task uuid, p_crate text, p_email text)
returns jsonb as $$
declare
  v_task kit_tasks;
  v_order kit_orders;
  v_label text;
  v_left int;
  v_event uuid;
begin
  select * into v_task from kit_tasks where id = p_task for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Task not found'); end if;
  if v_task.status = 'done' then
    return jsonb_build_object('ok', true, 'message', 'Already put away');
  end if;
  if v_task.status <> 'accepted'
     or (select email from kit_pickers where id = v_task.picker_id) is distinct from lower(trim(p_email)) then
    return jsonb_build_object('ok', false, 'message', 'Accept the task first');
  end if;

  select * into v_order from kit_orders where id = v_task.order_id for update;
  if v_order.status <> 'picking' then
    return jsonb_build_object('ok', false, 'message', 'Order is ' || v_order.status || ': stop');
  end if;
  select label into v_label from kit_pigeonholes where id = v_order.pigeonhole_id;
  if upper(trim(coalesce(p_crate, ''))) is distinct from upper(v_label) then
    return jsonb_build_object('ok', false, 'message', 'WRONG CRATE: this order goes in ' || v_label);
  end if;

  if exists (select 1 from kit_order_lines where task_id = p_task and status = 'pending' and picked_at is null) then
    return jsonb_build_object('ok', false, 'message', 'Pick every item first');
  end if;

  update kit_order_lines set status = 'done', done_at = now() where task_id = p_task and status = 'pending';
  update kit_tasks set status = 'done', done_at = now() where id = p_task;
  update kit_pickers set current_task_id = null, free_since = now() where id = v_task.picker_id;

  select count(*) into v_left from kit_order_lines where order_id = v_order.id and status = 'pending';
  if v_left = 0 then
    update kit_orders set status = 'ready', ready_at = now() where id = v_order.id;
    insert into kit_log (event_id, action, detail, actor)
    values (v_order.event_id, 'order_ready', v_order.code || ' at ' || v_label, p_email);
  end if;

  v_event := v_order.event_id;
  perform kit_dispatch(v_event);
  return jsonb_build_object('ok', true, 'message', case when v_left = 0 then 'Put away: order READY' else 'Put away' end,
    'orderReady', v_left = 0);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 7. Desk: hand over, cancel
-- ---------------------------------------------------------------------------
-- p_code is the crate label or the order code.
create or replace function kit_fulfil_order(p_event_id uuid, p_code text, p_photo text, p_admin text)
returns jsonb as $$
declare
  v_code text := upper(trim(p_code));
  v_order kit_orders;
begin
  select o.* into v_order
  from kit_orders o left join kit_pigeonholes h on h.id = o.pigeonhole_id
  where o.event_id = p_event_id and o.status in ('picking', 'ready')
    and (o.code = v_code or h.label = v_code)
  order by o.created_at desc limit 1
  for update of o;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'No open order for ' || v_code);
  end if;
  if v_order.status <> 'ready' then
    return jsonb_build_object('ok', false, 'message', 'Order ' || v_order.code || ' is not ready yet: still being picked');
  end if;

  update kit_orders
  set status = 'fulfilled', fulfilled_at = now(), fulfilled_by = p_admin, photo_path = p_photo
  where id = v_order.id;
  update kit_pigeonholes set status = 'free', order_id = null where id = v_order.pigeonhole_id;
  update registrations set checked_in = true, checked_in_at = now()
  where id in (select registration_id from kit_order_lines where order_id = v_order.id and status = 'done');

  insert into kit_log (event_id, action, detail, actor)
  values (p_event_id, 'fulfil', v_order.code, p_admin);
  return jsonb_build_object('ok', true, 'message', 'Handed over ' || v_order.code, 'code', v_order.code);
end;
$$ language plpgsql;

create or replace function kit_cancel_order(p_order uuid, p_reason text, p_admin text)
returns jsonb as $$
declare
  v_order kit_orders;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    return jsonb_build_object('ok', false, 'message', 'A reason is required');
  end if;
  select * into v_order from kit_orders where id = p_order for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Order not found'); end if;
  if v_order.status not in ('picking', 'ready') then
    return jsonb_build_object('ok', false, 'message', 'Order is already ' || v_order.status);
  end if;

  update kit_pickers set current_task_id = null, free_since = now()
  where current_task_id in (select id from kit_tasks where order_id = p_order);
  update kit_tasks set status = 'cancelled', picker_id = null, offer_expires_at = null
  where order_id = p_order and status <> 'done';
  update kit_order_lines set status = 'cancelled' where order_id = p_order;
  update kit_orders set status = 'cancelled', note = trim(p_reason) where id = p_order;
  update kit_pigeonholes set status = 'free', order_id = null where id = v_order.pigeonhole_id;

  insert into kit_log (event_id, action, detail, actor)
  values (v_order.event_id, 'exception', 'cancel ' || v_order.code || ' (' || trim(p_reason) || ')', p_admin);
  perform kit_dispatch(v_order.event_id);
  return jsonb_build_object('ok', true, 'message', 'Cancelled ' || v_order.code);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 8. Replaced functions
-- ---------------------------------------------------------------------------

-- Expo runners are no longer boxed. Generate now only makes corporate group boxes.
create or replace function kit_generate_boxes(p_event_id uuid, p_box_size int default 20)
returns jsonb as $$
declare
  r record;
  v_group text;
  v_box uuid;
  v_box_no int;
  v_in_box int;
  v_gboxes int := 0;
begin
  for v_group in
    select distinct reg.kit_group
    from registrations reg
    where reg.event_id = p_event_id and reg.payment_status = 'paid'
      and reg.kit_channel = 'corporate' and reg.kit_group is not null
      and not exists (select 1 from kit_items i where i.registration_id = reg.id)
    order by 1
  loop
    select coalesce(max(box_no), 0) into v_box_no
    from kit_boxes where event_id = p_event_id and kind = 'group_box' and kit_group = v_group;
    v_in_box := p_box_size;  -- forces a new box on the first runner

    for r in
      select reg.id, reg.bib_number, reg.tshirt_size
      from registrations reg
      where reg.event_id = p_event_id and reg.payment_status = 'paid'
        and reg.kit_channel = 'corporate' and reg.kit_group = v_group
        and not exists (select 1 from kit_items i where i.registration_id = reg.id)
      order by reg.bib_number, reg.created_at
    loop
      if v_in_box >= p_box_size then
        v_box_no := v_box_no + 1;
        insert into kit_boxes (event_id, code, kind, kit_group, box_no)
        values (p_event_id, 'KB-' || lpad(nextval('kit_box_code_seq')::text, 6, '0'), 'group_box', v_group, v_box_no)
        returning id into v_box;
        v_in_box := 0;
        v_gboxes := v_gboxes + 1;
      end if;
      perform kit_add_items(v_box, r.id, r.bib_number, r.tshirt_size);
      v_in_box := v_in_box + 1;
    end loop;
  end loop;

  insert into kit_log (event_id, action, detail)
  values (p_event_id, 'generate', v_gboxes || ' group boxes');

  return jsonb_build_object('bags', 0, 'groupBoxes', v_gboxes);
end;
$$ language plpgsql;

-- Leftover pre-packed expo bags from earlier dry runs (never touches collected ones).
create or replace function kit_clear_expo_bags(p_event_id uuid, p_admin text default null)
returns jsonb as $$
declare
  v_deleted int;
begin
  delete from kit_boxes where event_id = p_event_id and kind = 'expo_bag' and status <> 'collected';
  get diagnostics v_deleted = row_count;
  insert into kit_log (event_id, action, detail, actor)
  values (p_event_id, 'reset', v_deleted || ' leftover expo bags removed', p_admin);
  return jsonb_build_object('ok', true, 'deleted', v_deleted);
end;
$$ language plpgsql;

-- Size swap: also updates the runner's open order line (before it is picked).
create or replace function kit_swap_size(p_reg_id uuid, p_size text, p_reason text, p_admin text)
returns jsonb as $$
declare
  v_old text;
  v_event uuid;
  v_name text;
  v_size text := upper(trim(p_size));
  v_line kit_order_lines;
begin
  if v_size not in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL') then
    return jsonb_build_object('ok', false, 'message', 'Invalid size');
  end if;

  select tshirt_size, event_id, full_name into v_old, v_event, v_name
  from registrations where id = p_reg_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Runner not found');
  end if;
  if v_old is null then
    return jsonb_build_object('ok', false, 'message', 'This runner has no T-shirt (child runner)');
  end if;
  if v_old = v_size then
    return jsonb_build_object('ok', false, 'message', 'Already size ' || v_size);
  end if;

  select * into v_line from kit_order_lines
  where registration_id = p_reg_id and kind = 'tshirt' and status <> 'cancelled' for update;
  if found then
    if v_line.status = 'done' or v_line.picked_at is not null or v_line.opened_at is not null then
      return jsonb_build_object('ok', false, 'message',
        'The T-shirt is already being picked or packed: cancel the order and create it again');
    end if;
    update kit_order_lines set size = v_size, bin_code = 'TS-' || v_size where id = v_line.id;
  end if;

  update registrations set tshirt_size = v_size where id = p_reg_id;
  update kit_items set size = v_size where registration_id = p_reg_id and kind = 'tshirt';

  insert into kit_log (event_id, action, detail, actor)
  values (v_event, 'exception', 'size swap ' || v_name || ': ' || v_old || ' -> ' || v_size
    || coalesce(' (' || nullif(trim(p_reason), '') || ')', ''), p_admin);

  return jsonb_build_object('ok', true, 'message', 'Size changed ' || v_old || ' → ' || v_size);
end;
$$ language plpgsql;

-- Desk collect without the pick flow (support): records a fulfilled order with a reason.
create or replace function kit_desk_collect(p_reg_id uuid, p_reason text, p_admin text)
returns jsonb as $$
declare
  v_reg registrations;
  v_block text;
  v_order kit_orders;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    return jsonb_build_object('ok', false, 'message', 'A reason is required');
  end if;

  select * into v_reg from registrations where id = p_reg_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Runner not found');
  end if;
  v_block := kit_order_blocker(p_reg_id);
  if v_block is not null then
    return jsonb_build_object('ok', false, 'message', v_block);
  end if;

  insert into kit_orders (event_id, code, station, status, created_by, fulfilled_at, fulfilled_by, note)
  values (v_reg.event_id, 'O-' || lpad(nextval('kit_order_seq')::text, 4, '0'), 'S', 'fulfilled',
          p_admin, now(), p_admin, 'desk collect: ' || trim(p_reason))
  returning * into v_order;
  perform kit_build_lines(v_order.id, p_reg_id, 'done');

  update registrations set checked_in = true, checked_in_at = now() where id = p_reg_id;

  insert into kit_log (event_id, action, detail, actor)
  values (v_reg.event_id, 'exception',
    'desk collect ' || v_reg.full_name || ' (' || trim(p_reason) || ') ' || v_order.code, p_admin);

  return jsonb_build_object('ok', true, 'message', 'Collected at desk: ' || v_reg.full_name);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 9. Lock the functions down to the service role
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'kit_bib_bin(uuid)',
    'kit_build_lines(uuid, uuid, text)',
    'kit_order_blocker(uuid)',
    'kit_seed_pigeonholes(uuid, text[], int, int)',
    'kit_dispatch(uuid)',
    'kit_picker_set_active(uuid, text, text, boolean, text[])',
    'kit_create_order(uuid, uuid[], text, text)',
    'kit_accept_task(uuid, text)',
    'kit_decline_task(uuid, text)',
    'kit_release_task(uuid, text)',
    'kit_pick_bin(uuid, text, text)',
    'kit_pick_item(uuid, uuid[], text, text)',
    'kit_put_away(uuid, text, text)',
    'kit_fulfil_order(uuid, text, text, text)',
    'kit_cancel_order(uuid, text, text)',
    'kit_generate_boxes(uuid, int)',
    'kit_clear_expo_bags(uuid, text)',
    'kit_swap_size(uuid, text, text, text)',
    'kit_desk_collect(uuid, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
