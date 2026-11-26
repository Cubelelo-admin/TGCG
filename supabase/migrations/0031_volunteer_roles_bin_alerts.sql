-- Volunteer app roles + "bin empty" alerts (see docs/expo-on-demand-design.md).
--
-- 1. Two more volunteer roles on the allowlist:
--      handover : corporate group-box staging and day-0 handover (no runner details)
--      restock  : refills empty source bins (BIB files, T-shirt sizes, packs)
-- 2. kit_bin_alerts: a picker who finds a source bin empty flags it from the task screen;
--    restock sees the open alerts oldest first and resolves each by scanning the bin label.
--    One open alert per bin: a second picker flagging the same bin joins the open alert.
--
-- Safe to re-run. Service role only (RLS on, no policies), like every other kit table.
-- 0030 is not edited: the role check is dropped and re-created here with the wider list.

begin;

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------
alter table admin_allowlist drop constraint if exists admin_allowlist_role_check;
alter table admin_allowlist
  add constraint admin_allowlist_role_check
  check (role in ('admin', 'desk', 'picker', 'handover', 'restock'));

-- ---------------------------------------------------------------------------
-- 2. Bin alerts
-- ---------------------------------------------------------------------------
create table if not exists kit_bin_alerts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  bin_code text not null,                                  -- BF-42001-42100 / TS-M / PACK
  status text not null default 'open' check (status in ('open', 'resolved')),
  raised_by text not null,                                 -- picker email
  raised_at timestamptz not null default now(),
  task_id uuid references kit_tasks (id) on delete set null,
  reports int not null default 1,                          -- how many times it was flagged while open
  resolved_by text,
  resolved_at timestamptz
);

create unique index if not exists kit_bin_alerts_one_open_idx
  on kit_bin_alerts (event_id, bin_code) where status = 'open';
create index if not exists kit_bin_alerts_event_status_idx on kit_bin_alerts (event_id, status, raised_at);

alter table kit_bin_alerts enable row level security;

-- A picker flags a source bin of their accepted task as empty.
create or replace function kit_bin_empty(p_task uuid, p_bin text, p_email text)
returns jsonb as $$
declare
  v_task kit_tasks;
  v_event uuid;
  v_bin text := upper(trim(p_bin));
  v_email text := lower(trim(p_email));
  v_alert kit_bin_alerts;
begin
  select * into v_task from kit_tasks where id = p_task;
  if not found then return jsonb_build_object('ok', false, 'message', 'Task not found'); end if;
  if v_task.status <> 'accepted'
     or (select email from kit_pickers where id = v_task.picker_id) is distinct from v_email then
    return jsonb_build_object('ok', false, 'message', 'Accept the task first');
  end if;
  if not exists (select 1 from kit_order_lines where task_id = p_task and bin_code = v_bin) then
    return jsonb_build_object('ok', false, 'message', v_bin || ' is not a bin of this task');
  end if;

  select o.event_id into v_event from kit_orders o where o.id = v_task.order_id;

  insert into kit_bin_alerts (event_id, bin_code, raised_by, task_id)
  values (v_event, v_bin, v_email, p_task)
  on conflict (event_id, bin_code) where status = 'open'
  do update set reports = kit_bin_alerts.reports + 1
  returning * into v_alert;

  return jsonb_build_object(
    'ok', true,
    'message', case when v_alert.reports > 1 then v_bin || ' was already reported: restock is on it'
                    else 'Restock notified: ' || v_bin || ' is empty' end,
    'alertId', v_alert.id);
end;
$$ language plpgsql;

-- Restock marks a bin refilled (scan of its label, or a tap on the alert).
create or replace function kit_bin_refilled(p_event_id uuid, p_bin text, p_email text)
returns jsonb as $$
declare
  v_bin text := upper(trim(p_bin));
  v_id uuid;
begin
  update kit_bin_alerts
  set status = 'resolved', resolved_by = lower(trim(p_email)), resolved_at = now()
  where event_id = p_event_id and bin_code = v_bin and status = 'open'
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'message', 'No open alert for ' || v_bin);
  end if;
  return jsonb_build_object('ok', true, 'message', v_bin || ' refilled', 'alertId', v_id);
end;
$$ language plpgsql;

do $$
declare f text;
begin
  foreach f in array array[
    'kit_bin_empty(uuid, text, text)',
    'kit_bin_refilled(uuid, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
