-- Test script for 0035_task_scan.sql. Run AFTER the migration, in the Supabase SQL editor.
--
-- It checks kit_task_scan, the one action behind every scan during a picker's task:
--   - refusals with no result: an unknown task, a task not accepted yet, another picker's task
--   - T-shirt and pack tasks: the bin label picks; the same bin again = already picked; the
--     order's pigeonhole puts the task away; again on the done task = "Task done"
--   - the BIB task: a BIB before its bin = scan the bin first; the bin label opens it; the BIB
--     picks it; the same BIB again = already picked
--   - wrong pigeonhole, wrong bin, wrong BIB (only once a bin is open), and the pigeonhole
--     before everything is picked
--   - the order turns Ready when its last task is put away
-- It uses one test order for a real paid expo runner at a test desk (TST: 2 small + 1 large
-- pigeonhole) and three test pickers, one item each (p1 BIB, p2 T-shirt, p3 pack, @test.local).
-- Then it RAISES AN ERROR ON PURPOSE: the error message is the test report, and raising it rolls
-- back every change (no order, pigeonhole, picker, task or log row is left behind). The
-- order-number sequence skips a number.
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

-- True when a scan's answer has this ok and this result (a null result = a refusal).
create or replace function pg_temp.answered(p_res jsonb, p_ok boolean, p_result text)
returns boolean language sql as $$
  select coalesce((p_res->>'ok')::boolean = p_ok and (p_res->>'result') is not distinct from p_result, false)
$$;

do $$
declare
  ev uuid;
  a uuid;
  res jsonb;
  v_order uuid;
  v_bt uuid;        -- the BIB task (P1)
  v_ts uuid;        -- the T-shirt task (P2)
  v_pk uuid;        -- the pack task (P3)
  v_bib text;       -- the runner's BIB
  v_bib_bin text;   -- the BIB file it is in, e.g. BF-42001-42100
  v_ts_bin text;    -- e.g. TS-M
  v_size text;      -- e.g. M
  out text := '';
  fails int;
begin
  -- 1. One paid expo runner with a numeric BIB and a T-shirt, not collected, not in an order; a quiet floor
  select r.id into a from registrations r
  where r.payment_status = 'paid' and r.kit_channel = 'expo'
    and r.bib_number ~ '^\d+$' and r.tshirt_size is not null
    and kit_order_blocker(r.id) is null
  order by r.created_at limit 1;
  if a is null then
    raise exception 'TEST REPORT: cannot run, no eligible expo runner';
  end if;
  select event_id, bib_number into ev, v_bib from registrations where id = a;
  if exists (select 1 from kit_pickers where event_id = ev and active) then
    raise exception 'TEST REPORT: cannot run, a picker is active (pause everyone first)';
  end if;
  if exists (select 1 from kit_tasks k join kit_orders o on o.id = k.order_id
             where o.event_id = ev and k.status in ('queued', 'offered', 'accepted')) then
    raise exception 'TEST REPORT: cannot run, an order is being picked (finish or cancel it first)';
  end if;

  -- 2. Setup: TST with 2 small + 1 large pigeonhole, one specialist picker per item, one order
  res := kit_seed_pigeonholes(ev, array['TST'], 2, 1);
  out := out || pg_temp.chk('seed TST: 2 small + 1 large pigeonhole', (res->>'added')::int = 3, res);
  perform kit_picker_set_active(ev, 'p1@test.local', 'P1', true, array['bib']);
  perform kit_picker_set_active(ev, 'p2@test.local', 'P2', true, array['tshirt']);
  perform kit_picker_set_active(ev, 'p3@test.local', 'P3', true, array['pack']);
  res := kit_create_order(ev, array[a], 'TST', 'test');
  out := out || pg_temp.chk('test order created in TST-S1', (res->>'ok')::boolean and res->>'crate' = 'TST-S1', res);
  v_order := (res->>'orderId')::uuid;
  select id into v_bt from kit_tasks where order_id = v_order and kind = 'bib';
  select id into v_ts from kit_tasks where order_id = v_order and kind = 'tshirt';
  select id into v_pk from kit_tasks where order_id = v_order and kind = 'pack';
  select bin_code into v_bib_bin from kit_order_lines where task_id = v_bt;
  select bin_code, size into v_ts_bin, v_size from kit_order_lines where task_id = v_ts;
  out := out || pg_temp.chk('each task offered to its specialist',
    pg_temp.where_is(v_bt) = '{"status":"offered","picker":"p1@test.local"}'
    and pg_temp.where_is(v_ts) = '{"status":"offered","picker":"p2@test.local"}'
    and pg_temp.where_is(v_pk) = '{"status":"offered","picker":"p3@test.local"}',
    jsonb_build_array(pg_temp.where_is(v_bt), pg_temp.where_is(v_ts), pg_temp.where_is(v_pk)));

  -- 3. Refusals: no result, nothing picked
  res := kit_task_scan(v_ts, v_ts_bin, 'p2@test.local');
  out := out || pg_temp.chk('scan before Accept: "Accept the task first", no result',
    pg_temp.answered(res, false, null) and res->>'message' = 'Accept the task first', res);
  res := kit_task_scan(gen_random_uuid(), v_ts_bin, 'p2@test.local');
  out := out || pg_temp.chk('unknown task: "Task not found"',
    pg_temp.answered(res, false, null) and res->>'message' = 'Task not found', res);
  res := kit_accept_task(v_bt, 'p1@test.local');
  out := out || pg_temp.chk('P1 accepts the BIB task', (res->>'ok')::boolean, res);
  res := kit_accept_task(v_ts, 'p2@test.local');
  out := out || pg_temp.chk('P2 accepts the T-shirt task', (res->>'ok')::boolean, res);
  res := kit_accept_task(v_pk, 'p3@test.local');
  out := out || pg_temp.chk('P3 accepts the pack task', (res->>'ok')::boolean, res);
  res := kit_task_scan(v_ts, v_ts_bin, 'p1@test.local');
  out := out || pg_temp.chk('another picker''s task: "Accept the task first"',
    pg_temp.answered(res, false, null) and res->>'message' = 'Accept the task first', res);
  out := out || pg_temp.chk('the refused scans picked nothing',
    not exists (select 1 from kit_order_lines
                where order_id = v_order and (opened_at is not null or picked_at is not null)), null);

  -- 4. T-shirt task (P2)
  res := kit_task_scan(v_ts, 'TST-S1', 'p2@test.local');
  out := out || pg_temp.chk('own pigeonhole before picking: "Pick everything first"',
    pg_temp.answered(res, false, 'not-all-picked') and res->>'message' = 'Pick everything first', res);
  res := kit_task_scan(v_ts, 'TST-S2', 'p2@test.local');
  out := out || pg_temp.chk('another pigeonhole: "Wrong pigeonhole: TST-S2", goes in TST-S1',
    pg_temp.answered(res, false, 'wrong-pigeonhole') and res->>'message' = 'Wrong pigeonhole: TST-S2'
    and res->>'hint' = 'This task goes in TST-S1.', res);
  res := kit_task_scan(v_ts, 'PACK', 'p2@test.local');
  out := out || pg_temp.chk('a bin of another task: "Wrong bin: PACK"',
    pg_temp.answered(res, false, 'wrong-bin') and res->>'message' = 'Wrong bin: PACK', res);
  res := kit_task_scan(v_ts, v_bib, 'p2@test.local');
  out := out || pg_temp.chk('a BIB on the T-shirt task: wrong bin', pg_temp.answered(res, false, 'wrong-bin'), res);
  res := kit_task_scan(v_ts, lower(v_ts_bin), 'p2@test.local');
  out := out || pg_temp.chk('T-shirt bin label (lower case) picks it: "Picked 1 × size …"',
    pg_temp.answered(res, true, 'picked') and res->>'message' = 'Picked 1 × size ' || v_size || ' from ' || v_ts_bin, res);
  out := out || pg_temp.chk('T-shirt line opened and picked',
    (select bool_and(opened_at is not null and picked_at is not null) from kit_order_lines where task_id = v_ts), null);
  res := kit_task_scan(v_ts, v_ts_bin, 'p2@test.local');
  out := out || pg_temp.chk('the same bin again: "Bin … is already picked"',
    pg_temp.answered(res, false, 'already') and res->>'message' = 'Bin ' || v_ts_bin || ' is already picked', res);
  res := kit_task_scan(v_ts, ' tst-s1 ', 'p2@test.local');
  out := out || pg_temp.chk('own pigeonhole (spaces, lower case): "Task done", order not ready yet',
    pg_temp.answered(res, true, 'done') and res->>'message' = 'Task done' and not (res->>'orderReady')::boolean, res);
  out := out || pg_temp.chk('T-shirt task done, P2 free for the next one',
    (select status from kit_tasks where id = v_ts) = 'done'
    and (select current_task_id is null from kit_pickers where event_id = ev and email = 'p2@test.local'), null);
  res := kit_task_scan(v_ts, 'TST-S1', 'p2@test.local');
  out := out || pg_temp.chk('own pigeonhole again on the done task: "Task done"',
    pg_temp.answered(res, true, 'done') and res->>'message' = 'Task done', res);
  res := kit_task_scan(v_ts, v_ts_bin, 'p2@test.local');
  out := out || pg_temp.chk('anything else on the done task: refused', pg_temp.answered(res, false, null), res);
  out := out || pg_temp.chk('order still picking (BIB and pack left)',
    (select status from kit_orders where id = v_order) = 'picking', null);

  -- 5. Pack task (P3)
  res := kit_task_scan(v_pk, 'pack', 'p3@test.local');
  out := out || pg_temp.chk('PACK label picks it: "Picked 1 pack from PACK"',
    pg_temp.answered(res, true, 'picked') and res->>'message' = 'Picked 1 pack from PACK', res);
  res := kit_task_scan(v_pk, 'TST-S1', 'p3@test.local');
  out := out || pg_temp.chk('pack task put away', pg_temp.answered(res, true, 'done'), res);

  -- 6. BIB task (P1)
  res := kit_task_scan(v_bt, v_bib, 'p1@test.local');
  out := out || pg_temp.chk('BIB before its bin: "Scan the bin label first"',
    pg_temp.answered(res, false, 'bin-first') and res->>'message' = 'Scan the bin label first'
    and res->>'hint' = 'Bin ' || v_bib_bin || ', then BIB ' || v_bib || '.', res);
  res := kit_task_scan(v_bt, 'NOT-IN-ORDER', 'p1@test.local');
  out := out || pg_temp.chk('unknown code, no bin open yet: wrong bin', pg_temp.answered(res, false, 'wrong-bin'), res);
  res := kit_task_scan(v_bt, v_bib_bin, 'p1@test.local');
  out := out || pg_temp.chk('BIB bin label opens it: "Bin … open"',
    pg_temp.answered(res, true, 'opened') and res->>'message' = 'Bin ' || v_bib_bin || ' open', res);
  out := out || pg_temp.chk('BIB line opened, not picked yet',
    (select opened_at is not null and picked_at is null from kit_order_lines where task_id = v_bt), null);
  res := kit_task_scan(v_bt, 'TST-S1', 'p1@test.local');
  out := out || pg_temp.chk('own pigeonhole with the BIB still to pick: "Pick everything first"',
    pg_temp.answered(res, false, 'not-all-picked'), res);
  res := kit_task_scan(v_bt, 'NOT-IN-ORDER', 'p1@test.local');
  out := out || pg_temp.chk('unknown code with the bin open: "Wrong BIB: NOT-IN-ORDER"',
    pg_temp.answered(res, false, 'wrong-bib') and res->>'message' = 'Wrong BIB: NOT-IN-ORDER', res);
  res := kit_task_scan(v_bt, 'TST-L1', 'p1@test.local');
  out := out || pg_temp.chk('another pigeonhole with the bin open: still wrong pigeonhole',
    pg_temp.answered(res, false, 'wrong-pigeonhole'), res);
  res := kit_task_scan(v_bt, v_bib, 'p1@test.local');
  out := out || pg_temp.chk('the BIB picks it: "BIB … picked"',
    pg_temp.answered(res, true, 'bib') and res->>'message' = 'BIB ' || v_bib || ' picked', res);
  res := kit_task_scan(v_bt, v_bib, 'p1@test.local');
  out := out || pg_temp.chk('the same BIB again: already picked', pg_temp.answered(res, false, 'already'), res);
  res := kit_task_scan(v_bt, v_bib_bin, 'p1@test.local');
  out := out || pg_temp.chk('the BIB bin again: already picked', pg_temp.answered(res, false, 'already'), res);
  res := kit_task_scan(v_bt, 'TST-S1', 'p1@test.local');
  out := out || pg_temp.chk('last task put away: "Task done", order ready',
    pg_temp.answered(res, true, 'done') and (res->>'orderReady')::boolean, res);

  -- 7. The order waits at the desk
  out := out || pg_temp.chk('order turned Ready',
    (select status = 'ready' and ready_at is not null from kit_orders where id = v_order), null);
  out := out || pg_temp.chk('every line of the order done',
    not exists (select 1 from kit_order_lines where order_id = v_order and status <> 'done'), null);
  out := out || pg_temp.chk('P1, P2 and P3 free for the next task',
    not exists (select 1 from kit_pickers
                where event_id = ev and email like 'p_@test.local' and current_task_id is not null), null);

  fails := (length(out) - length(replace(out, E'\nFAIL ', ''))) / length(E'\nFAIL ');
  raise exception 'TEST REPORT: % failed (everything rolled back)%', fails, out;
end $$;
