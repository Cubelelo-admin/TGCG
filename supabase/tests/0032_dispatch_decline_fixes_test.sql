-- Test script for 0032_dispatch_decline_fixes.sql. Run AFTER the migration, in the
-- Supabase SQL editor.
--
-- It creates one test order for a real paid expo runner, with test pickers at a test desk
-- (TST), and checks:
--   - a decline no longer bounces straight back to the same picker, but another free picker
--     gets the task at once
--   - after the 60 s break it can come back to the picker who declined it
--   - Pause with an offer hands it back, and it goes to another free picker
--   - Pause is still refused with an accepted task
--   - a free specialist beats a non-specialist who has been free longer
-- Then it RAISES AN ERROR ON PURPOSE: the error message is the test report, and raising it
-- rolls back every change (no order, crate, picker or task is left behind). The order-number
-- sequence skips a number.
--
-- The whole script is one transaction, so now() doesn't move: "60 s later" is simulated by
-- moving declined_at / queued_at back.
--
-- Expected output: an error that starts with "TEST REPORT: 0 failed". Paste it back to Claude.
-- Run it while no real picker is active and no order is being picked.

create or replace function pg_temp.chk(p_name text, p_ok boolean, p_detail jsonb default null)
returns text language sql as $$
  select E'\n' || case when coalesce(p_ok, false) then 'PASS ' else 'FAIL ' end || p_name
    || case when coalesce(p_ok, false) then '' else '  ' || coalesce(p_detail::text, '(no detail)') end
$$;

-- Where the T-shirt task is now: {"status": ..., "picker": email or null}.
create or replace function pg_temp.where_is(p_task uuid)
returns jsonb language sql as $$
  select jsonb_build_object('status', k.status, 'picker', p.email)
  from kit_tasks k left join kit_pickers p on p.id = k.picker_id where k.id = p_task
$$;

do $$
declare
  ev uuid;
  a uuid;
  res jsonb;
  o_a uuid;
  v_ts uuid;
  w jsonb;
  v_active boolean;
  out text := '';
  fails int;
begin
  -- 0. One paid expo runner with a T-shirt, not collected, not in an order; a quiet floor
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
  -- Only P1 is active, T-shirt only: the T-shirt task can only go to P1.
  perform kit_picker_set_active(ev, 'p1@test.local', 'P1', true, array['tshirt']);

  res := kit_create_order(ev, array[a], 'TST', 'test');
  out := out || pg_temp.chk('test order created', (res->>'ok')::boolean, res);
  o_a := (res->>'orderId')::uuid;
  select id into v_ts from kit_tasks where order_id = o_a and kind = 'tshirt';
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('T-shirt task offered to P1', w = '{"status":"offered","picker":"p1@test.local"}', w);

  -- 1. P1 declines: the task stays in the queue (it used to come straight back to P1)
  res := kit_decline_task(v_ts, 'p1@test.local');
  out := out || pg_temp.chk('decline accepted', (res->>'ok')::boolean, res);
  perform kit_dispatch(ev);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('declined task not re-offered to P1 straight away', w->>'status' = 'queued', w);
  out := out || pg_temp.chk('decline time recorded',
    (select declined_at is not null from kit_tasks where id = v_ts), null);

  -- 2. Another T-shirt picker (P4) starts: they get it at once (the break is only for P1)
  perform kit_picker_set_active(ev, 'p4@test.local', 'P4', true, array['tshirt']);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('a fresh free picker gets the declined task at once',
    w = '{"status":"offered","picker":"p4@test.local"}', w);

  -- 3. P4 pauses with the offer on screen: handed back, P4 paused. P1 just declined it, so it
  --    waits in the queue rather than bouncing to P1.
  res := kit_picker_set_active(ev, 'p4@test.local', 'P4', false, null);
  out := out || pg_temp.chk('pause during an offer accepted', (res->>'ok')::boolean
    and res->>'message' like '%went back to the queue%', res);
  select active into v_active from kit_pickers where event_id = ev and email = 'p4@test.local';
  out := out || pg_temp.chk('P4 paused with no current task', not v_active
    and (select current_task_id is null from kit_pickers where event_id = ev and email = 'p4@test.local'),
    to_jsonb(v_active));
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('handed-back task waits (P1 is on their break)', w->>'status' = 'queued', w);

  -- 4. 60 s after the last turn-down: it can go back to P1 (the only active picker)
  update kit_tasks set declined_at = now() - interval '61 seconds' where id = v_ts;
  perform kit_dispatch(ev);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('offered to P1 again after the 60 s break',
    w = '{"status":"offered","picker":"p1@test.local"}', w);

  -- 5. P5 (T-shirt) starts while P1 holds the offer; then P1 pauses: P5 gets it at once
  perform kit_picker_set_active(ev, 'p5@test.local', 'P5', true, array['tshirt']);
  res := kit_picker_set_active(ev, 'p1@test.local', 'P1', false, null);
  out := out || pg_temp.chk('P1 pause during an offer accepted', (res->>'ok')::boolean, res);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('handed-back offer goes to the free picker (P5) at once',
    w = '{"status":"offered","picker":"p5@test.local"}', w);
  perform kit_picker_set_active(ev, 'p5@test.local', 'P5', false, null);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('everyone paused: task back in the queue', w->>'status' = 'queued', w);

  -- 6. Specialist first: only the T-shirt task left, waiting > 90 s (anyone may take it).
  --    P2 (BIB only) has been free longer than P3 (T-shirt): P3 must get it.
  update kit_tasks set status = 'done' where order_id = o_a and kind <> 'tshirt';
  update kit_tasks set queued_at = now() - interval '2 minutes' where id = v_ts;
  perform kit_picker_set_active(ev, 'p2@test.local', 'P2', true, array['bib']);
  perform kit_picker_set_active(ev, 'p3@test.local', 'P3', true, array['tshirt']);
  -- set_active dispatches straight away: undo any offer so both start free, then set the order.
  update kit_tasks set status = 'queued', picker_id = null, offered_at = null, offer_expires_at = null where id = v_ts;
  update kit_pickers set current_task_id = null where event_id = ev and email in ('p2@test.local', 'p3@test.local');
  update kit_pickers set free_since = now() - interval '5 minutes' where event_id = ev and email = 'p2@test.local';
  update kit_pickers set free_since = now() - interval '1 minute' where event_id = ev and email = 'p3@test.local';
  perform kit_dispatch(ev);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('free specialist (P3) beats earlier-free non-specialist (P2)', w->>'picker' = 'p3@test.local', w);

  -- 7. Pause with an ACCEPTED task is still refused
  res := kit_accept_task(v_ts, 'p3@test.local');
  out := out || pg_temp.chk('P3 accepts', (res->>'ok')::boolean, res);
  res := kit_picker_set_active(ev, 'p3@test.local', 'P3', false, null);
  out := out || pg_temp.chk('pause with an accepted task refused', not (res->>'ok')::boolean, res);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('accepted task untouched, P3 still active', w->>'status' = 'accepted'
    and (select active from kit_pickers where event_id = ev and email = 'p3@test.local'), w);

  fails := (length(out) - length(replace(out, E'\nFAIL ', ''))) / length(E'\nFAIL ');
  raise exception 'TEST REPORT: % failed (everything rolled back)%', fails, out;
end $$;
