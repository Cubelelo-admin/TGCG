-- One action for every scan during a picker's task (docs/volunteer-assignments-design.md §4.2,
-- volunteer assignments Part 2). The spec calls this migration 0034; that number went to another
-- workstream (0034_raigarh_2027_details.sql), so it is 0035.
--
-- kit_task_scan(task, code, email): the picker's screen sends every scan here (camera, typed, or
-- a hardware scanner), and the answer says what the scan did: {ok, result, message, hint}.
-- message = what happened (the alert's title), hint = what to do now (the line under it).
-- Checked in this order:
--   1. This order's pigeonhole: everything picked -> put away (kit_put_away; the order turns
--      Ready when it was the last task) = done. Not everything picked = not-all-picked.
--   2. A bin of this task: nothing left to pick in it = already. A BIB bin -> opened. A T-shirt or
--      pack bin -> every line this task needs from it is picked = picked (the bin label is the check).
--   3. A BIB of this task: picked already = already; its bin not open yet = bin-first; else
--      picked = bib.
--   4. Another pigeonhole of this event = wrong-pigeonhole.
--   5. Anything else: a BIB task with a bin open = wrong-bib, otherwise wrong-bin.
-- ok is true only for picked / opened / bib / done. A task that isn't accepted, or isn't the
-- caller's, is refused with "Accept the task first" and no result, like the 0030 pick functions.
-- One exception: the pigeonhole scanned again after the task is done (the camera reading it twice)
-- answers "Task done".
--
-- kit_pick_bin, kit_pick_item and kit_put_away stay: a phone still on the old screen keeps working
-- during the deploy. 0025-0034 are not edited. Safe to re-run. Service role only, like every other
-- kit function.

begin;

create or replace function kit_task_scan(p_task uuid, p_code text, p_email text)
returns jsonb as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_task kit_tasks;
  v_mine boolean;
  v_order kit_orders;
  v_label text;           -- this order's pigeonhole
  v_bin text;             -- the scanned bin, when it is one of this task's
  v_left int;
  v_size text;
  v_line kit_order_lines;
  v_res jsonb;
begin
  -- Locked for the whole scan: two scans of one task never interleave.
  select * into v_task from kit_tasks where id = p_task for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Task not found'); end if;
  v_mine := coalesce(
    (select email from kit_pickers where id = v_task.picker_id) = lower(trim(coalesce(p_email, ''))), false);
  select * into v_order from kit_orders where id = v_task.order_id;
  select label into v_label from kit_pigeonholes where id = v_order.pigeonhole_id;

  -- The pigeonhole read again after the task finished (the camera still sees it).
  if v_task.status = 'done' and v_mine and v_code = upper(v_label) then
    return jsonb_build_object('ok', true, 'result', 'done', 'message', 'Task done',
      'hint', 'It is in pigeonhole ' || v_label || '.');
  end if;
  if v_task.status <> 'accepted' or not v_mine then
    return jsonb_build_object('ok', false, 'message', 'Accept the task first');
  end if;

  -- 1. This order's pigeonhole
  if v_code = upper(v_label) then
    select count(*) into v_left from kit_order_lines
    where task_id = p_task and status = 'pending' and picked_at is null;
    if v_left > 0 then
      return jsonb_build_object('ok', false, 'result', 'not-all-picked', 'message', 'Pick everything first',
        'hint', v_left || ' still to pick. Then scan ' || v_label || ' again.');
    end if;
    v_res := kit_put_away(p_task, v_label, p_email);
    if not coalesce((v_res->>'ok')::boolean, false) then
      return jsonb_build_object('ok', false, 'message', v_res->>'message');
    end if;
    return jsonb_build_object('ok', true, 'result', 'done', 'message', 'Task done',
      'hint', 'Dropped in pigeonhole ' || v_label || '. The next task comes to this screen.',
      'orderReady', coalesce((v_res->>'orderReady')::boolean, false));
  end if;

  -- 2. A bin of this task
  select bin_code into v_bin from kit_order_lines
  where task_id = p_task and status = 'pending' and upper(bin_code) = v_code
  limit 1;
  if v_bin is not null then
    select count(*) filter (where picked_at is null), max(size) into v_left, v_size
    from kit_order_lines where task_id = p_task and status = 'pending' and bin_code = v_bin;
    if v_left = 0 then
      return jsonb_build_object('ok', false, 'result', 'already', 'message', 'Bin ' || v_bin || ' is already picked',
        'hint', 'Nothing more to take from it.');
    end if;
    update kit_order_lines set opened_at = coalesce(opened_at, now())
    where task_id = p_task and status = 'pending' and bin_code = v_bin and picked_at is null;
    if v_task.kind = 'bib' then
      return jsonb_build_object('ok', true, 'result', 'opened', 'message', 'Bin ' || v_bin || ' open',
        'hint', 'Now scan each BIB as you take it.');
    end if;
    -- T-shirts and packs: the bin label is the check, so it picks what this task needs from the bin.
    update kit_order_lines set picked_at = now()
    where task_id = p_task and status = 'pending' and bin_code = v_bin and picked_at is null;
    return jsonb_build_object('ok', true, 'result', 'picked', 'message',
      'Picked ' || v_left
        || case when v_task.kind = 'tshirt' then ' × size ' || coalesce(v_size, '?')
                when v_left = 1 then ' pack' else ' packs' end
        || ' from ' || v_bin);
  end if;

  -- 3. A BIB of this task
  if v_task.kind = 'bib' then
    select l.* into v_line
    from kit_order_lines l join registrations r on r.id = l.registration_id
    where l.task_id = p_task and l.kind = 'bib' and l.status = 'pending' and upper(r.bib_number) = v_code
    limit 1;
    if found then
      if v_line.picked_at is not null then
        return jsonb_build_object('ok', false, 'result', 'already', 'message', 'BIB ' || v_code || ' is already picked',
          'hint', 'Carry on with the next step.');
      end if;
      if v_line.opened_at is null then
        return jsonb_build_object('ok', false, 'result', 'bin-first', 'message', 'Scan the bin label first',
          'hint', 'Bin ' || v_line.bin_code || ', then BIB ' || v_code || '.');
      end if;
      update kit_order_lines set picked_at = now() where id = v_line.id;
      return jsonb_build_object('ok', true, 'result', 'bib', 'message', 'BIB ' || v_code || ' picked');
    end if;
  end if;

  -- 4. Another pigeonhole of this event
  if exists (select 1 from kit_pigeonholes where event_id = v_order.event_id and upper(label) = v_code) then
    return jsonb_build_object('ok', false, 'result', 'wrong-pigeonhole', 'message', 'Wrong pigeonhole: ' || v_code,
      'hint', 'This task goes in ' || v_label || '.');
  end if;

  -- 5. Anything else
  if v_task.kind = 'bib' and exists (
    select 1 from kit_order_lines where task_id = p_task and status = 'pending' and opened_at is not null
  ) then
    return jsonb_build_object('ok', false, 'result', 'wrong-bib', 'message', 'Wrong BIB: ' || v_code,
      'hint', 'It isn''t in this order. Put it back.');
  end if;
  return jsonb_build_object('ok', false, 'result', 'wrong-bin', 'message', 'Wrong bin: ' || v_code,
    'hint', 'It isn''t in this task. Put back anything you took from it.');
end;
$$ language plpgsql;

do $$
begin
  revoke execute on function kit_task_scan(uuid, text, text) from public, anon, authenticated;
  grant execute on function kit_task_scan(uuid, text, text) to service_role;
end $$;

commit;
