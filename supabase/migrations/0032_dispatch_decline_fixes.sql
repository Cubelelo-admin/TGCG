-- Dispatch fixes from the expo dry run (26 Nov 2026). 0030 is not edited: the three functions
-- below are replaced here.
--
-- 1. Decline bounced straight back. A picker who declined (or let an offer lapse) was only
--    sorted last, so when they were the only free picker for that kind the same task was
--    offered to them again within a second, with "sent to another picker" on screen. Now
--    whoever turned a task down gets a 60 s break from it, counted from the last time it was
--    turned down (new column kit_tasks.declined_at). Other pickers can take it at once. After
--    the break it can come back to them if nobody else has taken it.
--    The break is per task, not per picker: coming back from a pause or finishing another
--    task doesn't restart it.
-- 2. Specialists first. A task waiting over 90 s can go to anyone free, but when a specialist
--    for that kind is free at the same moment, the specialist gets it.
-- 3. Pause during an offer. kit_picker_set_active(false) refused while a task was offered
--    ("Finish or decline your current task first") and decline re-offered it at once, so a
--    picker could not stop. Pausing with an OFFERED task now hands it back (as a decline) and
--    pauses. An ACCEPTED task still has to be finished or given back first.
--
-- A supervisor Release (kit_release_task, unchanged) doesn't set declined_at: the released
-- picker is paused, and when they tap Start again the task may go back to them.
--
-- Safe to re-run. Service role only, like every other kit function.

begin;

-- When the task was last turned down: declined, offer lapsed, or handed back by Pause.
alter table kit_tasks add column if not exists declined_at timestamptz;

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
        declined_at = now(),
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
    select k.id, k.kind, k.queued_at, k.declined_by, k.declined_at
    from kit_tasks k join kit_orders o on o.id = k.order_id
    where o.event_id = p_event_id and k.status = 'queued' and o.status = 'picking'
    order by k.queued_at
    for update of k skip locked
  loop
    select p.id into v_picker
    from kit_pickers p
    where p.event_id = p_event_id and p.active and p.current_task_id is null
      and (t.kind = any (p.specialties) or t.queued_at < now() - interval '90 seconds')
      -- Whoever turned this task down gets a 60 s break from it. (declined_at is null for a
      -- task turned down before 0032, or only released by a supervisor: no break.)
      and (not (p.id = any (t.declined_by)) or t.declined_at is null
           or t.declined_at <= now() - interval '60 seconds')
    -- Fresh pickers before ones who turned it down, specialists before the rest, then
    -- whoever has been free longest.
    order by (p.id = any (t.declined_by)), (t.kind = any (p.specialties)) desc, p.free_since
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
  set status = 'queued', declined_by = declined_by || v_picker.id, declined_at = now(), picker_id = null,
      offered_at = null, offer_expires_at = null, accepted_at = null
  where id = p_task;
  update kit_pickers set current_task_id = null, free_since = now() where id = v_picker.id;

  select event_id into v_event from kit_orders where id = v_task.order_id;
  perform kit_dispatch(v_event);
  return jsonb_build_object('ok', true, 'message', 'Declined: it goes to another picker');
end;
$$ language plpgsql;

create or replace function kit_picker_set_active(
  p_event_id uuid, p_email text, p_name text, p_active boolean, p_specialties text[] default null
) returns jsonb as $$
declare
  v_email text := lower(trim(p_email));
  v_picker kit_pickers;
  v_task kit_tasks;
  v_handed_back boolean := false;
begin
  insert into kit_pickers (event_id, email, name)
  values (p_event_id, v_email, nullif(trim(coalesce(p_name, '')), ''))
  on conflict (event_id, email) do nothing;

  select * into v_picker from kit_pickers where event_id = p_event_id and email = v_email for update;

  if not p_active and v_picker.current_task_id is not null then
    select * into v_task from kit_tasks where id = v_picker.current_task_id for update;
    if found and v_task.picker_id = v_picker.id and v_task.status = 'offered' then
      -- Pausing with an offer on screen = hand it back (like a decline), then pause.
      update kit_tasks
      set status = 'queued', declined_by = declined_by || v_picker.id, declined_at = now(),
          picker_id = null, offered_at = null, offer_expires_at = null
      where id = v_task.id;
      update kit_pickers set current_task_id = null, free_since = now() where id = v_picker.id;
      v_handed_back := true;
    elsif found and v_task.picker_id = v_picker.id and v_task.status = 'accepted' then
      return jsonb_build_object('ok', false, 'message', 'Finish this task or give it back first');
    else
      -- Stale pointer (task done, cancelled, or no longer theirs): just clear it.
      update kit_pickers set current_task_id = null where id = v_picker.id;
    end if;
  end if;

  update kit_pickers
  set active = p_active,
      free_since = case when p_active and not v_picker.active then now() else free_since end,
      name = coalesce(nullif(trim(coalesce(p_name, '')), ''), name),
      specialties = coalesce(p_specialties, specialties)
  where id = v_picker.id;

  -- Active: look for a task for them. Handed back: offer it to someone else.
  if p_active or v_handed_back then perform kit_dispatch(p_event_id); end if;

  return jsonb_build_object('ok', true, 'message',
    case when p_active then 'You are active'
         when v_handed_back then 'Paused: the offer went back to the queue'
         else 'You are paused' end);
end;
$$ language plpgsql;

do $$
declare f text;
begin
  foreach f in array array[
    'kit_dispatch(uuid)',
    'kit_decline_task(uuid, text)',
    'kit_picker_set_active(uuid, text, text, boolean, text[])'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
