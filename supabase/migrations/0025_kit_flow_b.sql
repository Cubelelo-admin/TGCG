-- Flow B kit distribution core (see the "TGCG Kit Pickup Plan" artifact).
--
-- Every paid runner is routed to exactly one channel:
--   expo       -> one "expo bag" (kit_boxes.kind = 'expo_bag') packed before
--                 the expo, collected by the runner at a counter.
--   corporate  -> numbered "group boxes" packed per kit_group (the POC / company),
--                 handed to the company rep on day 0.
-- Each box knows what it must hold (kit_items). Pickers scan items into the box
-- (kit_scan); when the last item is in, the box turns 'ready' by itself.
--
-- Item scan codes (what a picker scans):
--   BIB   -> the runner's BIB number; only accepted into that runner's own box
--   TS-M  -> a size bin label (T-shirts have no barcode: the bin scan stands in)
--   PACK  -> the pre-made accessory pack bin label (clips, bottle, bag, napkin)
--
-- Not in this migration (later): stock/bin counts, pickup slots, roles beyond the
-- admin allowlist, handover photo. Safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- 1. Channel on the runner record
-- ---------------------------------------------------------------------------
alter table registrations
  add column if not exists kit_channel text not null default 'expo',
  add column if not exists kit_group text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'registrations_kit_channel_check') then
    alter table registrations
      add constraint registrations_kit_channel_check check (kit_channel in ('expo', 'corporate'));
  end if;
end $$;

create index if not exists registrations_kit_group_idx
  on registrations (event_id, kit_group) where kit_group is not null;

-- ---------------------------------------------------------------------------
-- 2. Boxes, items, handovers, activity log
-- ---------------------------------------------------------------------------
create sequence if not exists kit_box_code_seq;

create table if not exists kit_boxes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  code text not null unique,                       -- printed on the label, e.g. KB-000123
  kind text not null check (kind in ('expo_bag', 'group_box')),
  registration_id uuid references registrations(id), -- expo_bag only
  kit_group text,                                    -- group_box only
  box_no int,                                        -- group_box: 1..n within its group
  shelf_address text,                                -- expo_bag: set when ready
  status text not null default 'open'
    check (status in ('open', 'ready', 'staged', 'handed_over', 'collected')),
  ready_at timestamptz,
  staged_at timestamptz,
  handed_over_at timestamptz,
  collected_at timestamptz,
  handover_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists kit_boxes_expo_bag_reg_idx
  on kit_boxes (registration_id) where kind = 'expo_bag';
create index if not exists kit_boxes_event_status_idx on kit_boxes (event_id, status);
create index if not exists kit_boxes_group_idx on kit_boxes (event_id, kit_group) where kit_group is not null;

create table if not exists kit_items (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references kit_boxes(id) on delete cascade,
  registration_id uuid not null references registrations(id),
  kind text not null check (kind in ('bib', 'tshirt', 'pack')),
  size text,                                       -- tshirt only
  scanned_at timestamptz,
  scanned_by text,
  unique (registration_id, kind)                   -- one of each per runner; makes generation idempotent
);

create index if not exists kit_items_box_idx on kit_items (box_id);

create table if not exists kit_handovers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  kit_group text not null,
  receiver_name text not null,
  receiver_mobile text not null,
  box_count int not null,
  handed_by text,
  handed_at timestamptz not null default now()
);

create table if not exists kit_log (
  id bigint generated always as identity primary key,
  event_id uuid references events(id),
  box_code text,
  action text not null,
  ok boolean not null default true,
  detail text,
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists kit_log_created_idx on kit_log (created_at desc);

-- Same posture as every PII table: RLS on, no policies; only the service role
-- (server routes) ever touches these.
alter table kit_boxes enable row level security;
alter table kit_items enable row level security;
alter table kit_handovers enable row level security;
alter table kit_log enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Generate boxes (idempotent: only runners with no items yet)
-- ---------------------------------------------------------------------------
create or replace function kit_add_items(p_box uuid, p_reg uuid, p_bib text, p_size text)
returns void as $$
begin
  -- Child Runner ("SUPERHERO") has no BIB and no adult accessory pack.
  if p_bib is not null and p_bib <> 'SUPERHERO' then
    insert into kit_items (box_id, registration_id, kind) values (p_box, p_reg, 'bib');
  end if;
  insert into kit_items (box_id, registration_id, kind, size) values (p_box, p_reg, 'tshirt', upper(p_size));
  if p_bib is distinct from 'SUPERHERO' then
    insert into kit_items (box_id, registration_id, kind) values (p_box, p_reg, 'pack');
  end if;
end;
$$ language plpgsql;

create or replace function kit_generate_boxes(p_event_id uuid, p_box_size int default 20)
returns jsonb as $$
declare
  r record;
  v_group text;
  v_box uuid;
  v_box_no int;
  v_in_box int;
  v_bags int := 0;
  v_gboxes int := 0;
begin
  -- Expo: one bag per runner, in BIB order.
  for r in
    select reg.id, reg.bib_number, reg.tshirt_size
    from registrations reg
    where reg.event_id = p_event_id and reg.payment_status = 'paid' and reg.kit_channel = 'expo'
      and not exists (select 1 from kit_items i where i.registration_id = reg.id)
    order by reg.bib_number, reg.created_at
  loop
    insert into kit_boxes (event_id, code, kind, registration_id)
    values (p_event_id, 'KB-' || lpad(nextval('kit_box_code_seq')::text, 6, '0'), 'expo_bag', r.id)
    returning id into v_box;
    perform kit_add_items(v_box, r.id, r.bib_number, r.tshirt_size);
    v_bags := v_bags + 1;
  end loop;

  -- Corporate: group boxes of up to p_box_size runners, per kit_group.
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
  values (p_event_id, 'generate', v_bags || ' expo bags, ' || v_gboxes || ' group boxes');

  return jsonb_build_object('bags', v_bags, 'groupBoxes', v_gboxes);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 4. Scan an item into a box; auto-ready on the last item
-- ---------------------------------------------------------------------------
create or replace function kit_shelf_address(p_reg uuid)
returns text as $$
declare
  v_prefix text;
  v_bib text;
  v_seq int;
  v_digits int;
  v_shelf int;
begin
  select tc.bib_prefix, r.bib_number into v_prefix, v_bib
  from registrations r join ticket_categories tc on tc.id = r.ticket_category_id
  where r.id = p_reg;

  if v_bib is null or v_bib = 'SUPERHERO' then return 'Rack KIDS'; end if;
  if v_prefix is null or v_bib !~ '^\d+$' then return 'Rack MISC'; end if;

  v_digits := 5 - length(v_prefix);
  v_seq := substring(v_bib from length(v_prefix) + 1)::int;
  v_shelf := (v_seq - 1) / 20;
  return 'Rack ' || v_prefix || 'K · Shelf ' || (v_shelf + 1) || ' · BIBs '
    || v_prefix || lpad((v_shelf * 20 + 1)::text, v_digits, '0') || '–'
    || v_prefix || lpad(((v_shelf + 1) * 20)::text, v_digits, '0');
end;
$$ language plpgsql stable;

create or replace function kit_scan(p_box_code text, p_code text, p_admin text)
returns jsonb as $$
declare
  v_box kit_boxes;
  v_code text := upper(trim(p_code));
  v_item uuid;
  v_total int;
  v_done int;
  v_status text;
  v_shelf text;
  v_other text;
  v_what text;
begin
  select * into v_box from kit_boxes where code = upper(trim(p_box_code)) for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Unknown box label');
  end if;
  if v_box.status <> 'open' then
    return jsonb_build_object('ok', false, 'message', 'This box is already ' || replace(v_box.status, '_', ' '));
  end if;

  if v_code like 'TS-%' then
    v_what := 'T-shirt ' || substr(v_code, 4);
    select id into v_item from kit_items
    where box_id = v_box.id and kind = 'tshirt' and size = substr(v_code, 4) and scanned_at is null
    limit 1;
    if v_item is null then
      insert into kit_log (event_id, box_code, action, ok, detail, actor)
      values (v_box.event_id, v_box.code, 'scan', false, 'unexpected ' || v_code, p_admin);
      return jsonb_build_object('ok', false, 'message', 'Not needed: this box has no unscanned ' || v_what);
    end if;
  elsif v_code = 'PACK' then
    v_what := 'accessory pack';
    select id into v_item from kit_items
    where box_id = v_box.id and kind = 'pack' and scanned_at is null limit 1;
    if v_item is null then
      insert into kit_log (event_id, box_code, action, ok, detail, actor)
      values (v_box.event_id, v_box.code, 'scan', false, 'unexpected PACK', p_admin);
      return jsonb_build_object('ok', false, 'message', 'Not needed: all accessory packs for this box are already in');
    end if;
  else
    v_what := 'BIB ' || v_code;
    select i.id into v_item
    from kit_items i join registrations r on r.id = i.registration_id
    where i.box_id = v_box.id and i.kind = 'bib' and upper(r.bib_number) = v_code and i.scanned_at is null
    limit 1;
    if v_item is null then
      -- Say why: already in, belongs to another box, or unknown.
      if exists (
        select 1 from kit_items i join registrations r on r.id = i.registration_id
        where i.box_id = v_box.id and i.kind = 'bib' and upper(r.bib_number) = v_code
      ) then
        return jsonb_build_object('ok', false, 'message', 'BIB ' || v_code || ' is already scanned into this box');
      end if;
      select b.code into v_other
      from kit_items i join registrations r on r.id = i.registration_id join kit_boxes b on b.id = i.box_id
      where i.kind = 'bib' and upper(r.bib_number) = v_code and r.event_id = v_box.event_id limit 1;
      insert into kit_log (event_id, box_code, action, ok, detail, actor)
      values (v_box.event_id, v_box.code, 'scan', false, 'wrong BIB ' || v_code, p_admin);
      return jsonb_build_object('ok', false, 'message',
        case when v_other is not null
          then 'WRONG BOX: BIB ' || v_code || ' belongs in ' || v_other
          else 'Unknown BIB ' || v_code end);
    end if;
  end if;

  update kit_items set scanned_at = now(), scanned_by = p_admin where id = v_item;

  select count(*), count(scanned_at) into v_total, v_done from kit_items where box_id = v_box.id;
  v_status := 'open';
  if v_done = v_total then
    v_status := 'ready';
    if v_box.kind = 'expo_bag' then
      v_shelf := kit_shelf_address(v_box.registration_id);
    end if;
    update kit_boxes set status = 'ready', ready_at = now(), shelf_address = v_shelf where id = v_box.id;
    insert into kit_log (event_id, box_code, action, detail, actor)
    values (v_box.event_id, v_box.code, 'ready', v_total || ' items', p_admin);
  end if;

  return jsonb_build_object('ok', true, 'message', 'Added ' || v_what,
    'scanned', v_done, 'total', v_total, 'status', v_status, 'shelf', v_shelf);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 5. Corporate: stage a ready group box, then hand the group over on day 0
-- ---------------------------------------------------------------------------
create or replace function kit_stage(p_box_code text, p_admin text)
returns jsonb as $$
declare
  v_box kit_boxes;
  v_total int;
  v_staged int;
begin
  select * into v_box from kit_boxes where code = upper(trim(p_box_code)) for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Unknown box label');
  end if;
  if v_box.kind <> 'group_box' then
    return jsonb_build_object('ok', false, 'message', 'This is an expo bag, not a group box');
  end if;
  if v_box.status = 'staged' then
    return jsonb_build_object('ok', false, 'message', 'Already staged');
  end if;
  if v_box.status <> 'ready' then
    return jsonb_build_object('ok', false, 'message',
      case when v_box.status = 'open' then 'Box is not complete yet: finish picking first'
           else 'Box is already ' || replace(v_box.status, '_', ' ') end);
  end if;

  update kit_boxes set status = 'staged', staged_at = now() where id = v_box.id;
  insert into kit_log (event_id, box_code, action, detail, actor)
  values (v_box.event_id, v_box.code, 'stage', v_box.kit_group, p_admin);

  select count(*), count(*) filter (where status in ('staged', 'handed_over'))
  into v_total, v_staged
  from kit_boxes where event_id = v_box.event_id and kind = 'group_box' and kit_group = v_box.kit_group;

  return jsonb_build_object('ok', true, 'message', 'Staged ' || v_box.code,
    'group', v_box.kit_group, 'boxNo', v_box.box_no, 'staged', v_staged, 'total', v_total);
end;
$$ language plpgsql;

create or replace function kit_handover(
  p_event_id uuid, p_group text, p_name text, p_mobile text, p_codes text[], p_admin text
) returns jsonb as $$
declare
  v_expected text[];
  v_given text[];
  v_unstaged int;
  v_id uuid;
begin
  perform 1 from kit_boxes
    where event_id = p_event_id and kind = 'group_box' and kit_group = p_group for update;

  select array_agg(code order by code) into v_expected
  from kit_boxes where event_id = p_event_id and kind = 'group_box' and kit_group = p_group;
  if v_expected is null then
    return jsonb_build_object('ok', false, 'message', 'No boxes for this group');
  end if;

  select count(*) into v_unstaged from kit_boxes
  where event_id = p_event_id and kind = 'group_box' and kit_group = p_group and status <> 'staged';
  if v_unstaged > 0 then
    return jsonb_build_object('ok', false, 'message',
      v_unstaged || ' box(es) of this group are not staged (or already handed over)');
  end if;

  select array_agg(distinct upper(trim(c)) order by upper(trim(c))) into v_given from unnest(p_codes) c;
  if v_given is distinct from v_expected then
    return jsonb_build_object('ok', false, 'message',
      'Scanned boxes do not match the group: scan every box of this group out');
  end if;

  insert into kit_handovers (event_id, kit_group, receiver_name, receiver_mobile, box_count, handed_by)
  values (p_event_id, p_group, trim(p_name), trim(p_mobile), array_length(v_expected, 1), p_admin)
  returning id into v_id;

  update kit_boxes set status = 'handed_over', handed_over_at = now(), handover_id = v_id
  where event_id = p_event_id and kind = 'group_box' and kit_group = p_group;

  insert into kit_log (event_id, action, detail, actor)
  values (p_event_id, 'handover', p_group || ' → ' || trim(p_name) || ' (' || trim(p_mobile) || ')', p_admin);

  return jsonb_build_object('ok', true, 'message', 'Handed over', 'handoverId', v_id,
    'boxes', array_length(v_expected, 1));
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 6. Expo counter: the scanned bag must belong to the scanned runner
-- ---------------------------------------------------------------------------
create or replace function kit_collect(p_bag_code text, p_reg_id uuid, p_admin text)
returns jsonb as $$
declare
  v_box kit_boxes;
  v_name text;
begin
  select * into v_box from kit_boxes where code = upper(trim(p_bag_code)) for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Unknown bag label');
  end if;
  if v_box.kind <> 'expo_bag' then
    return jsonb_build_object('ok', false, 'message', 'This is a group box, not an expo bag');
  end if;
  if v_box.registration_id is distinct from p_reg_id then
    insert into kit_log (event_id, box_code, action, ok, detail, actor)
    values (v_box.event_id, v_box.code, 'collect', false, 'wrong bag for runner', p_admin);
    return jsonb_build_object('ok', false, 'message', 'WRONG BAG: this bag belongs to a different runner');
  end if;
  if v_box.status = 'collected' then
    return jsonb_build_object('ok', false, 'message',
      'Already collected at ' || to_char(v_box.collected_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'));
  end if;
  if v_box.status <> 'ready' then
    return jsonb_build_object('ok', false, 'message', 'Bag is not complete: send to the exceptions desk');
  end if;

  update kit_boxes set status = 'collected', collected_at = now() where id = v_box.id;
  update registrations set checked_in = true, checked_in_at = now() where id = p_reg_id
  returning full_name into v_name;
  insert into kit_log (event_id, box_code, action, detail, actor)
  values (v_box.event_id, v_box.code, 'collect', v_name, p_admin);

  return jsonb_build_object('ok', true, 'message', 'Collected', 'name', v_name);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 7. Summaries for the admin kit page (aggregated in Postgres: the 1000-row cap)
-- ---------------------------------------------------------------------------
create or replace function kit_poc_summary(p_event_id uuid)
returns table (poc_name text, paid_count bigint, corporate_count bigint, boxed_count bigint) as $$
  select r.poc_name,
         count(*),
         count(*) filter (where r.kit_channel = 'corporate'),
         count(*) filter (where exists (select 1 from kit_items i where i.registration_id = r.id))
  from registrations r
  where r.event_id = p_event_id and r.payment_status = 'paid' and r.poc_name is not null
  group by r.poc_name
  order by r.poc_name;
$$ language sql stable;

create or replace function kit_status_counts(p_event_id uuid)
returns table (kind text, status text, box_count bigint) as $$
  select kind, status, count(*) from kit_boxes where event_id = p_event_id group by kind, status;
$$ language sql stable;

create or replace function kit_channel_counts(p_event_id uuid)
returns table (kit_channel text, paid_count bigint, boxed_count bigint) as $$
  select r.kit_channel, count(*),
         count(*) filter (where exists (select 1 from kit_items i where i.registration_id = r.id))
  from registrations r
  where r.event_id = p_event_id and r.payment_status = 'paid'
  group by r.kit_channel;
$$ language sql stable;

do $$
declare
  f text;
begin
  foreach f in array array[
    'kit_add_items(uuid, uuid, text, text)',
    'kit_generate_boxes(uuid, int)',
    'kit_shelf_address(uuid)',
    'kit_scan(text, text, text)',
    'kit_stage(text, text)',
    'kit_handover(uuid, text, text, text, text[], text)',
    'kit_collect(text, uuid, text)',
    'kit_poc_summary(uuid)',
    'kit_status_counts(uuid)',
    'kit_channel_counts(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
