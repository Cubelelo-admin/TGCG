-- Test script for 0030_expo_orders.sql. Run AFTER the migration, in the Supabase SQL editor.
--
-- It walks the whole expo flow on 4 real paid expo runners (create order, offer, accept,
-- scan bin, pick, put away, ready, hand over, 60 s expiry, cancel, group order, size swap)
-- and then RAISES AN ERROR ON PURPOSE. The error message is the test report, and raising it
-- rolls back every change: no order, crate, picker, check-in or log row is left behind.
-- The only side effect is that the order-number sequence skips a few numbers.
--
-- Expected output: an error that starts with "TEST REPORT: 0 failed". Paste it back to Claude.
-- Run it before real pickers go active (an active real picker could be offered a test task
-- inside this transaction; it is rolled back, but the counts in the report would differ).

create or replace function pg_temp.chk(p_name text, p_ok boolean, p_detail jsonb default null)
returns text language sql as $$
  select E'\n' || case when coalesce(p_ok, false) then 'PASS ' else 'FAIL ' end || p_name
    || case when coalesce(p_ok, false) then '' else '  ' || coalesce(p_detail::text, '(no detail)') end
$$;

do $$
declare
  ev uuid;
  ids uuid[];
  a uuid; b uuid; c uuid; d uuid;
  res jsonb;
  o_a uuid; o_b uuid; o_g uuid;
  t record;
  l record;
  v_bin text;
  v_lines uuid[];
  v_task uuid;
  v_picker uuid;
  v_size text;
  n int;
  out text := '';
  fails int;
begin
  -- 4 paid expo runners with a numeric BIB and a T-shirt, not collected, not in an order
  select array_agg(id) into ids from (
    select r.id from registrations r
    where r.payment_status = 'paid' and r.kit_channel = 'expo'
      and r.bib_number ~ '^\d+$' and r.tshirt_size is not null
      and kit_order_blocker(r.id) is null
    order by r.created_at limit 4
  ) s;
  if coalesce(array_length(ids, 1), 0) < 4 then
    raise exception 'TEST REPORT: cannot run, fewer than 4 eligible expo runners';
  end if;
  a := ids[1]; b := ids[2]; c := ids[3]; d := ids[4];
  select event_id into ev from registrations where id = a;
  if (select count(distinct event_id) from registrations where id = any (ids)) > 1 then
    raise exception 'TEST REPORT: cannot run, the 4 runners are in different events';
  end if;

  out := out || pg_temp.chk('bib file label looks like BF-xxxxx-xxxxx', kit_bib_bin(a) ~ '^BF-\d{5}-\d{5}$',
    to_jsonb(kit_bib_bin(a)));

  -- Setup: station TST with 1 small + 1 large crate, 3 active pickers (all specialties)
  res := kit_seed_pigeonholes(ev, array['TST'], 1, 1);
  out := out || pg_temp.chk('seed 2 crates', (res->>'added')::int = 2, res);
  perform kit_picker_set_active(ev, 'p1@test.local', 'P1', true);
  perform kit_picker_set_active(ev, 'p2@test.local', 'P2', true);
  perform kit_picker_set_active(ev, 'p3@test.local', 'P3', true);

  -- 1. Single order A gets the small crate and 3 tasks, all offered
  res := kit_create_order(ev, array[a], 'TST', 'test');
  out := out || pg_temp.chk('order A created in TST-S1', (res->>'ok')::boolean and res->>'crate' = 'TST-S1', res);
  o_a := (res->>'orderId')::uuid;
  select count(*) into n from kit_tasks where order_id = o_a and status = 'offered';
  out := out || pg_temp.chk('order A: 3 tasks offered', n = 3, to_jsonb(n));

  -- 2. Same runner again is refused
  res := kit_create_order(ev, array[a], 'TST', 'test');
  out := out || pg_temp.chk('duplicate order for A refused', not (res->>'ok')::boolean
    and res->>'message' like '%already in open order%', res);

  -- 3. Single order B falls back to the large crate; its tasks wait (pickers busy)
  res := kit_create_order(ev, array[b], 'TST', 'test');
  out := out || pg_temp.chk('order B falls back to TST-L1', (res->>'ok')::boolean and res->>'crate' = 'TST-L1', res);
  o_b := (res->>'orderId')::uuid;
  select count(*) into n from kit_tasks where order_id = o_b and status = 'queued';
  out := out || pg_temp.chk('order B: tasks queued while pickers are busy', n = 3, to_jsonb(n));

  -- 4. Group C+D refused: no free large crate
  res := kit_create_order(ev, array[c, d], 'TST', 'test');
  out := out || pg_temp.chk('group refused: no large crate free', not (res->>'ok')::boolean
    and res->>'message' like 'No free large crate%', res);

  -- 5. Pick order A end to end
  for t in
    select k.id, k.kind, p.email from kit_tasks k join kit_pickers p on p.id = k.picker_id
    where k.order_id = o_a
  loop
    res := kit_pick_bin(t.id, 'PACK', t.email);
    out := out || pg_temp.chk(t.kind || ': bin scan before accept refused', not (res->>'ok')::boolean, res);
    res := kit_accept_task(t.id, 'someone@else.local');
    out := out || pg_temp.chk(t.kind || ': accept by another picker refused', not (res->>'ok')::boolean, res);
    res := kit_accept_task(t.id, t.email);
    out := out || pg_temp.chk(t.kind || ': accepted', (res->>'ok')::boolean, res);
    res := kit_pick_bin(t.id, 'NOT-A-BIN', t.email);
    out := out || pg_temp.chk(t.kind || ': wrong bin refused', not (res->>'ok')::boolean, res);
    res := kit_put_away(t.id, 'TST-S1', t.email);
    out := out || pg_temp.chk(t.kind || ': put away before picking refused', not (res->>'ok')::boolean, res);

    for v_bin in select distinct bin_code from kit_order_lines where task_id = t.id loop
      res := kit_pick_bin(t.id, v_bin, t.email);
      out := out || pg_temp.chk(t.kind || ': bin ' || v_bin || ' opened', (res->>'ok')::boolean
        and jsonb_array_length(res->'items') > 0, res);
      if t.kind = 'bib' then
        for l in
          select ol.id, r.bib_number from kit_order_lines ol join registrations r on r.id = ol.registration_id
          where ol.task_id = t.id and ol.bin_code = v_bin
        loop
          res := kit_pick_item(t.id, array[l.id], 'X' || l.bib_number, t.email);
          out := out || pg_temp.chk('bib: wrong BIB refused', not (res->>'ok')::boolean, res);
          res := kit_pick_item(t.id, array[l.id], l.bib_number, t.email);
          out := out || pg_temp.chk('bib: right BIB picked', (res->>'ok')::boolean, res);
        end loop;
      else
        select array_agg(id) into v_lines from kit_order_lines where task_id = t.id and bin_code = v_bin;
        res := kit_pick_item(t.id, v_lines, null, t.email);
        out := out || pg_temp.chk(t.kind || ': items picked', (res->>'ok')::boolean, res);
      end if;
    end loop;

    res := kit_put_away(t.id, 'TST-L1', t.email);
    out := out || pg_temp.chk(t.kind || ': wrong crate refused', not (res->>'ok')::boolean, res);
    res := kit_put_away(t.id, 'tst-s1', t.email);
    out := out || pg_temp.chk(t.kind || ': put away (lower-case scan ok)', (res->>'ok')::boolean, res);
    res := kit_put_away(t.id, 'TST-S1', t.email);
    out := out || pg_temp.chk(t.kind || ': repeat put away is harmless', (res->>'ok')::boolean, res);
  end loop;

  out := out || pg_temp.chk('order A is ready',
    (select status from kit_orders where id = o_a) = 'ready', null);

  -- 6. Hand over by scanning the crate
  res := kit_fulfil_order(ev, 'TST-L1', null, 'test');
  out := out || pg_temp.chk('hand over of a not-ready order refused', not (res->>'ok')::boolean, res);
  res := kit_fulfil_order(ev, 'TST-S1', null, 'test');
  out := out || pg_temp.chk('order A handed over', (res->>'ok')::boolean, res);
  out := out || pg_temp.chk('crate TST-S1 is free again',
    (select status from kit_pigeonholes where event_id = ev and label = 'TST-S1') = 'free', null);
  out := out || pg_temp.chk('runner A checked in', (select checked_in from registrations where id = a), null);
  res := kit_create_order(ev, array[a], 'TST', 'test');
  out := out || pg_temp.chk('runner A cannot order again', not (res->>'ok')::boolean
    and res->>'message' like '%already collected%', res);

  -- 7. Freed pickers got order B's tasks; let one offer lapse past 60 s
  select count(*) into n from kit_tasks where order_id = o_b and status = 'offered';
  out := out || pg_temp.chk('order B tasks offered once pickers were free', n = 3, to_jsonb(n));
  select id, picker_id into v_task, v_picker from kit_tasks where order_id = o_b and status = 'offered' limit 1;
  update kit_tasks set offer_expires_at = now() - interval '1 second' where id = v_task;
  perform kit_dispatch(ev);
  out := out || pg_temp.chk('lapsed task back in the queue',
    (select status from kit_tasks where id = v_task) = 'queued', null);
  out := out || pg_temp.chk('lapsed picker paused and freed',
    (select not active and current_task_id is null from kit_pickers where id = v_picker), null);
  res := kit_accept_task(v_task, (select email from kit_pickers where id = v_picker));
  out := out || pg_temp.chk('lapsed picker can no longer accept', not (res->>'ok')::boolean, res);
  perform kit_picker_set_active(ev, 'p4@test.local', 'P4', true);
  out := out || pg_temp.chk('lapsed task re-offered to a different picker (P4)',
    (select p.email from kit_tasks k join kit_pickers p on p.id = k.picker_id where k.id = v_task) = 'p4@test.local', null);
  res := kit_picker_set_active(ev, 'p4@test.local', 'P4', false);
  out := out || pg_temp.chk('busy picker cannot go inactive', not (res->>'ok')::boolean, res);

  -- 8. Cancel order B: crate and pickers released
  res := kit_cancel_order(o_b, '', 'test');
  out := out || pg_temp.chk('cancel without reason refused', not (res->>'ok')::boolean, res);
  res := kit_cancel_order(o_b, 'test cancel', 'test');
  out := out || pg_temp.chk('order B cancelled', (res->>'ok')::boolean, res);
  out := out || pg_temp.chk('crate TST-L1 free after cancel',
    (select status from kit_pigeonholes where event_id = ev and label = 'TST-L1') = 'free', null);
  select count(*) into n from kit_pickers where event_id = ev and email like '%@test.local' and current_task_id is not null;
  out := out || pg_temp.chk('no test picker still holds a task', n = 0, to_jsonb(n));

  -- 9. Group order C+D now gets the large crate
  res := kit_create_order(ev, array[c, d], 'TST', 'test');
  out := out || pg_temp.chk('group C+D gets TST-L1', (res->>'ok')::boolean and res->>'crate' = 'TST-L1', res);
  o_g := (res->>'orderId')::uuid;
  select count(*) into n from kit_tasks where order_id = o_g;
  out := out || pg_temp.chk('group: one task per kind (3)', n = 3, to_jsonb(n));
  select count(*) into n from kit_order_lines where order_id = o_g;
  out := out || pg_temp.chk('group: 6 lines (3 per runner)', n = 6, to_jsonb(n));

  -- 10. Size swap on an open, not-yet-picked line follows through to the line
  select case when tshirt_size = 'M' then 'L' else 'M' end into v_size from registrations where id = c;
  res := kit_swap_size(c, v_size, 'test', 'test');
  out := out || pg_temp.chk('size swap on open order', (res->>'ok')::boolean, res);
  out := out || pg_temp.chk('order line follows the new size',
    (select bin_code from kit_order_lines where registration_id = c and kind = 'tshirt' and status <> 'cancelled') = 'TS-' || v_size, null);

  -- 11. Desk collect refuses a runner who is in an open order
  res := kit_desk_collect(d, 'test reason', 'test');
  out := out || pg_temp.chk('desk collect refuses runner in open order', not (res->>'ok')::boolean, res);

  fails := (length(out) - length(replace(out, E'\nFAIL ', ''))) / length(E'\nFAIL ');
  raise exception 'TEST REPORT: % failed (everything rolled back)%', fails, out;
end $$;
