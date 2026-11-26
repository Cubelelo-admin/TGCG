-- Test script for 0031_volunteer_roles_bin_alerts.sql. Run AFTER the migration, in the
-- Supabase SQL editor.
--
-- It checks the two new roles on the allowlist, then creates one test order for a real paid
-- expo runner, accepts its T-shirt task, flags the bin empty (twice, and from the wrong
-- picker / wrong bin), and refills it. Then it RAISES AN ERROR ON PURPOSE: the error message
-- is the test report, and raising it rolls back every change (no allowlist row, order,
-- crate, picker or alert is left behind). The order-number sequence skips a number.
--
-- Expected output: an error that starts with "TEST REPORT: 0 failed". Paste it back to Claude.
-- Run it before real pickers go active, like the 0030 test.

create or replace function pg_temp.chk(p_name text, p_ok boolean, p_detail jsonb default null)
returns text language sql as $$
  select E'\n' || case when coalesce(p_ok, false) then 'PASS ' else 'FAIL ' end || p_name
    || case when coalesce(p_ok, false) then '' else '  ' || coalesce(p_detail::text, '(no detail)') end
$$;

do $$
declare
  ev uuid;
  a uuid;
  res jsonb;
  o_a uuid;
  v_task uuid;
  v_email text;
  v_bin text;
  n int;
  ok boolean;
  out text := '';
  fails int;
begin
  -- 1. Roles: the new values are accepted, a made-up one is not
  insert into admin_allowlist (email, role) values ('handover@test.local', 'handover'), ('restock@test.local', 'restock');
  out := out || pg_temp.chk('handover and restock roles accepted',
    (select count(*) from admin_allowlist where email in ('handover@test.local', 'restock@test.local')) = 2, null);
  begin
    insert into admin_allowlist (email, role) values ('bad@test.local', 'superuser');
    ok := false;
  exception when check_violation then
    ok := true;
  end;
  out := out || pg_temp.chk('unknown role refused', ok, null);

  -- 2. One paid expo runner with a T-shirt, not collected, not in an order
  select r.id into a from registrations r
  where r.payment_status = 'paid' and r.kit_channel = 'expo' and r.tshirt_size is not null
    and kit_order_blocker(r.id) is null
  order by r.created_at limit 1;
  if a is null then
    raise exception 'TEST REPORT: cannot run, no eligible expo runner%', out;
  end if;
  select event_id into ev from registrations where id = a;

  perform kit_seed_pigeonholes(ev, array['TST'], 1, 1);
  perform kit_picker_set_active(ev, 'p1@test.local', 'P1', true, array['tshirt']);

  res := kit_create_order(ev, array[a], 'TST', 'test');
  out := out || pg_temp.chk('test order created', (res->>'ok')::boolean, res);
  o_a := (res->>'orderId')::uuid;

  select k.id, p.email into v_task, v_email
  from kit_tasks k join kit_pickers p on p.id = k.picker_id
  where k.order_id = o_a and k.kind = 'tshirt';
  out := out || pg_temp.chk('T-shirt task offered to the test picker', v_email = 'p1@test.local', to_jsonb(v_email));
  select bin_code into v_bin from kit_order_lines where task_id = v_task limit 1;

  -- 3. Flagging before accepting is refused
  res := kit_bin_empty(v_task, v_bin, v_email);
  out := out || pg_temp.chk('bin empty before accept refused', not (res->>'ok')::boolean, res);

  res := kit_accept_task(v_task, v_email);
  out := out || pg_temp.chk('task accepted', (res->>'ok')::boolean, res);

  -- 4. Wrong picker / wrong bin refused
  res := kit_bin_empty(v_task, v_bin, 'someone@else.local');
  out := out || pg_temp.chk('bin empty by another picker refused', not (res->>'ok')::boolean, res);
  res := kit_bin_empty(v_task, 'NOT-A-BIN', v_email);
  out := out || pg_temp.chk('bin empty for a bin not in the task refused', not (res->>'ok')::boolean, res);

  -- 5. Flag it: one open alert; flagging again joins the same alert
  res := kit_bin_empty(v_task, lower(v_bin), v_email);
  out := out || pg_temp.chk('bin flagged empty (lower-case scan ok)', (res->>'ok')::boolean, res);
  res := kit_bin_empty(v_task, v_bin, v_email);
  out := out || pg_temp.chk('second flag joins the open alert', (res->>'ok')::boolean
    and res->>'message' like '%already reported%', res);
  select count(*) into n from kit_bin_alerts where event_id = ev and bin_code = v_bin and status = 'open';
  out := out || pg_temp.chk('exactly one open alert for the bin', n = 1, to_jsonb(n));
  out := out || pg_temp.chk('alert counts 2 reports',
    (select reports from kit_bin_alerts where event_id = ev and bin_code = v_bin and status = 'open') = 2, null);

  -- 6. Refill resolves it; refilling again finds nothing open
  res := kit_bin_refilled(ev, v_bin, 'restock@test.local');
  out := out || pg_temp.chk('bin refilled', (res->>'ok')::boolean, res);
  select count(*) into n from kit_bin_alerts where event_id = ev and bin_code = v_bin and status = 'open';
  out := out || pg_temp.chk('no open alert after refill', n = 0, to_jsonb(n));
  res := kit_bin_refilled(ev, v_bin, 'restock@test.local');
  out := out || pg_temp.chk('second refill says nothing open', not (res->>'ok')::boolean, res);

  -- 7. After a refill the same bin can be flagged again (a new alert)
  res := kit_bin_empty(v_task, v_bin, v_email);
  out := out || pg_temp.chk('bin can be flagged again after refill', (res->>'ok')::boolean
    and res->>'message' not like '%already reported%', res);
  select count(*) into n from kit_bin_alerts where event_id = ev and bin_code = v_bin;
  out := out || pg_temp.chk('two alerts in history (one resolved, one open)', n = 2, to_jsonb(n));

  fails := (length(out) - length(replace(out, E'\nFAIL ', ''))) / length(E'\nFAIL ');
  raise exception 'TEST REPORT: % failed (everything rolled back)%', fails, out;
end $$;
