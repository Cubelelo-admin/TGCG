-- Test script for 0033_volunteer_assignments.sql. Run AFTER the migration, in the
-- Supabase SQL editor.
--
-- It checks:
--   - admin_allowlist keeps a desk only on a desk row and items only on a picker row, and refuses
--     an unknown item or an over-long desk name
--   - kit_picker_items_changed with items left: specialties follow on every event's row and the
--     picker stays active
--   - with no items left: the picker is paused and an offer on their screen goes back to the queue
--   - with no items left: an accepted task stays theirs, and they're paused
--   - an unknown item is refused; an email with no picker rows is fine
-- It uses one test order for a real paid expo runner at a test desk (TST), test pickers and a test
-- allowlist email (@test.local). Then it RAISES AN ERROR ON PURPOSE: the error message is the
-- test report, and raising it rolls back every change (no order, pigeonhole, picker, task or
-- allowlist row is left behind). The order-number sequence skips a number.
--
-- Expected output: an error that starts with "TEST REPORT: 0 failed". Paste it back to Claude.
-- Run it while no real picker is active and no order is being picked.

create or replace function pg_temp.chk(p_name text, p_ok boolean, p_detail jsonb default null)
returns text language sql as $$
  select E'\n' || case when coalesce(p_ok, false) then 'PASS ' else 'FAIL ' end || p_name
    || case when coalesce(p_ok, false) then '' else '  ' || coalesce(p_detail::text, '(no detail)') end
$$;

-- Where a task is now: {"status": ..., "picker": email or null}.
create or replace function pg_temp.where_is(p_task uuid)
returns jsonb language sql as $$
  select jsonb_build_object('status', k.status, 'picker', p.email)
  from kit_tasks k left join kit_pickers p on p.id = k.picker_id where k.id = p_task
$$;

-- A test picker's row on one event, as JSON (for failure details).
create or replace function pg_temp.picker(p_event uuid, p_email text)
returns jsonb language sql as $$
  select to_jsonb(p) from kit_pickers p where p.event_id = p_event and p.email = p_email
$$;

-- True when admin_allowlist refuses this row with a check constraint. The row is never kept.
create or replace function pg_temp.refused(p_role text, p_desk text, p_items text[])
returns boolean language plpgsql as $$
begin
  insert into admin_allowlist (email, role, desk, picker_items)
  values ('assign-check@test.local', p_role, p_desk, p_items);
  delete from admin_allowlist where email = 'assign-check@test.local';
  return false;
exception when check_violation then
  return true;
end $$;

do $$
declare
  ev uuid;
  ev2 uuid;
  a uuid;
  res jsonb;
  o_a uuid;
  v_ts uuid;
  w jsonb;
  out text := '';
  fails int;
begin
  -- 1. Constraints on admin_allowlist
  out := out || pg_temp.chk('desk volunteer with a desk accepted', not pg_temp.refused('desk', 'D1', '{}'));
  out := out || pg_temp.chk('picker with items accepted', not pg_temp.refused('picker', null, array['bib', 'pack']));
  out := out || pg_temp.chk('handover with nothing assigned accepted', not pg_temp.refused('handover', null, '{}'));
  out := out || pg_temp.chk('desk on a picker row refused', pg_temp.refused('picker', 'D1', array['bib']));
  out := out || pg_temp.chk('items on a desk row refused', pg_temp.refused('desk', 'D1', array['bib']));
  out := out || pg_temp.chk('desk on a restock row refused', pg_temp.refused('restock', 'D1', '{}'));
  out := out || pg_temp.chk('unknown item refused', pg_temp.refused('picker', null, array['bag']));
  out := out || pg_temp.chk('desk name over 10 characters refused', pg_temp.refused('desk', 'DESK-NUMBER-1', '{}'));

  -- 2. One paid expo runner with a T-shirt, not collected, not in an order; a quiet floor
  select r.id into a from registrations r
  where r.payment_status = 'paid' and r.kit_channel = 'expo' and r.tshirt_size is not null
    and kit_order_blocker(r.id) is null
  order by r.created_at limit 1;
  if a is null then
    raise exception 'TEST REPORT: cannot run, no eligible expo runner';
  end if;
  select event_id into ev from registrations where id = a;
  if exists (select 1 from kit_pickers where event_id = ev and active) then
    raise exception 'TEST REPORT: cannot run, a picker is active (pause everyone first)';
  end if;
  if exists (select 1 from kit_tasks k join kit_orders o on o.id = k.order_id
             where o.event_id = ev and k.status in ('queued', 'offered', 'accepted')) then
    raise exception 'TEST REPORT: cannot run, an order is being picked (finish or cancel it first)';
  end if;
  perform kit_seed_pigeonholes(ev, array['TST'], 1, 1);

  -- 3. Items changed, some left: specialties follow on every event's row; still active
  select id into ev2 from events where id <> ev order by id limit 1;
  if ev2 is not null then
    insert into kit_pickers (event_id, email, name) values (ev2, 'p1@test.local', 'P1');
  end if;
  perform kit_picker_set_active(ev, 'p1@test.local', 'P1', true, array['bib', 'tshirt', 'pack']);
  res := kit_picker_items_changed(' P1@Test.Local ', array['pack']);
  out := out || pg_temp.chk('items change accepted (email case and spaces ignored)', (res->>'ok')::boolean, res);
  out := out || pg_temp.chk('new items on this event''s row, picker still active',
    (select specialties = array['pack'] and active from kit_pickers where event_id = ev and email = 'p1@test.local'),
    pg_temp.picker(ev, 'p1@test.local'));
  out := out || pg_temp.chk('new items on the other event''s row too',
    ev2 is null or (select specialties = array['pack'] from kit_pickers where event_id = ev2 and email = 'p1@test.local'),
    pg_temp.picker(ev2, 'p1@test.local'));
  perform kit_picker_set_active(ev, 'p1@test.local', 'P1', false, null);

  -- 4. No items left with an offer on screen: the offer goes back to the queue, picker paused
  perform kit_picker_set_active(ev, 'p2@test.local', 'P2', true, array['tshirt']);
  res := kit_create_order(ev, array[a], 'TST', 'test');
  out := out || pg_temp.chk('test order created', (res->>'ok')::boolean, res);
  o_a := (res->>'orderId')::uuid;
  select id into v_ts from kit_tasks where order_id = o_a and kind = 'tshirt';
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('T-shirt task offered to P2', w = '{"status":"offered","picker":"p2@test.local"}', w);

  res := kit_picker_items_changed('p2@test.local', '{}');
  out := out || pg_temp.chk('items removed: one offer handed back', (res->>'ok')::boolean and (res->>'handedBack')::int = 1, res);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('the offer went back to the queue', w->>'status' = 'queued', w);
  out := out || pg_temp.chk('counted as turned down by P2 (60 s break)',
    (select k.declined_at is not null and p.id = any (k.declined_by)
     from kit_tasks k, kit_pickers p
     where k.id = v_ts and p.event_id = ev and p.email = 'p2@test.local'), null);
  out := out || pg_temp.chk('P2 paused, no task, no items',
    (select not active and current_task_id is null and specialties = '{}'
     from kit_pickers where event_id = ev and email = 'p2@test.local'),
    pg_temp.picker(ev, 'p2@test.local'));

  -- 5. No items left with an accepted task: it stays theirs; they're paused
  perform kit_picker_set_active(ev, 'p3@test.local', 'P3', true, array['tshirt']);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('T-shirt task offered to P3', w = '{"status":"offered","picker":"p3@test.local"}', w);
  res := kit_accept_task(v_ts, 'p3@test.local');
  out := out || pg_temp.chk('P3 accepts', (res->>'ok')::boolean, res);
  res := kit_picker_items_changed('p3@test.local', '{}');
  out := out || pg_temp.chk('items removed mid-task: nothing handed back', (res->>'ok')::boolean and (res->>'handedBack')::int = 0, res);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('accepted task still P3''s', w = '{"status":"accepted","picker":"p3@test.local"}', w);
  out := out || pg_temp.chk('P3 paused but still holds the task',
    (select not active and current_task_id = v_ts from kit_pickers where event_id = ev and email = 'p3@test.local'),
    pg_temp.picker(ev, 'p3@test.local'));

  -- 6. Unknown item refused, nothing changed
  res := kit_picker_items_changed('p1@test.local', array['bag']);
  out := out || pg_temp.chk('unknown item refused', not (res->>'ok')::boolean, res);
  out := out || pg_temp.chk('P1 items unchanged after the refusal',
    (select specialties = array['pack'] from kit_pickers where event_id = ev and email = 'p1@test.local'),
    pg_temp.picker(ev, 'p1@test.local'));

  -- 7. An email that never picked: nothing to change, still ok
  res := kit_picker_items_changed('nobody@test.local', array['bib']);
  out := out || pg_temp.chk('email with no picker rows: ok, nobody paused',
    (res->>'ok')::boolean and (res->>'paused')::int = 0, res);

  fails := (length(out) - length(replace(out, E'\nFAIL ', ''))) / length(E'\nFAIL ');
  raise exception 'TEST REPORT: % failed (everything rolled back)%', fails, out;
end $$;
